//! 基于角色的访问控制 (RBAC)
//!
//! 定义角色层级和权限检查逻辑。
//! 角色: admin > auditor > writer > reader

use std::collections::{HashMap, HashSet};
use crate::error::{HunTianError, HunTianResult};

/// 预定义角色
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Role {
    /// 超级管理员 — 所有权限
    Admin,
    /// 安全审计员 — 读取 + 快照 + 取证
    Auditor,
    /// 数据写入者 — 写入 + 读取
    Writer,
    /// 只读用户 — 仅查询
    Reader,
}

impl Role {
    /// 从字符串解析角色
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "admin" => Some(Role::Admin),
            "auditor" => Some(Role::Auditor),
            "writer" => Some(Role::Writer),
            "reader" => Some(Role::Reader),
            _ => None,
        }
    }

    /// 角色层级数值（越大权限越高）
    pub fn level(&self) -> u8 {
        match self {
            Role::Admin => 4,
            Role::Auditor => 3,
            Role::Writer => 2,
            Role::Reader => 1,
        }
    }
}

/// 权限操作
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Permission {
    /// INSERT 事件写入
    WriteEvents,
    /// SELECT 查询
    ReadEvents,
    /// 创建快照
    CreateSnapshot,
    /// 取证追踪
    ForensicTrace,
    /// 管理用户和角色
    ManageUsers,
    /// 系统配置
    ManageConfig,
}

/// RBAC 权限管理器
pub struct RbacManager {
    /// 角色 → 权限列表 映射
    role_permissions: HashMap<Role, HashSet<Permission>>,
}

impl RbacManager {
    pub fn new() -> Self {
        let mut role_permissions = HashMap::new();

        // Admin: 所有权限
        role_permissions.insert(Role::Admin, {
            let mut perms = HashSet::new();
            perms.insert(Permission::WriteEvents);
            perms.insert(Permission::ReadEvents);
            perms.insert(Permission::CreateSnapshot);
            perms.insert(Permission::ForensicTrace);
            perms.insert(Permission::ManageUsers);
            perms.insert(Permission::ManageConfig);
            perms
        });

        // Auditor: 读取 + 快照 + 取证
        role_permissions.insert(Role::Auditor, {
            let mut perms = HashSet::new();
            perms.insert(Permission::ReadEvents);
            perms.insert(Permission::CreateSnapshot);
            perms.insert(Permission::ForensicTrace);
            perms
        });

        // Writer: 写入 + 读取
        role_permissions.insert(Role::Writer, {
            let mut perms = HashSet::new();
            perms.insert(Permission::WriteEvents);
            perms.insert(Permission::ReadEvents);
            perms
        });

        // Reader: 仅读取
        role_permissions.insert(Role::Reader, {
            let mut perms = HashSet::new();
            perms.insert(Permission::ReadEvents);
            perms
        });

        Self { role_permissions }
    }

    /// 检查指定角色是否有某权限
    pub fn check_permission(&self, role: &Role, required: &Permission) -> bool {
        self.role_permissions
            .get(role)
            .map(|perms| perms.contains(required))
            .unwrap_or(false)
    }

    /// 检查用户是否有足够权限执行操作
    pub fn require_permission(&self, role: &Role, required: &Permission) -> HunTianResult<()> {
        if self.check_permission(role, required) {
            Ok(())
        } else {
            Err(HunTianError::Forbidden {
                required: format!("{:?}", required),
                current: format!("{:?}", role),
            })
        }
    }
}
