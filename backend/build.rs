// 从项目根 VERSION 文件读取版本号，注入为编译时常量
// 用法: env!("HUNTIAN_VERSION") / env!("HUNTIAN_BETA_TAG")
use std::fs;

fn main() {
    let version = fs::read_to_string("../VERSION")
        .expect("无法读取 ../VERSION 文件")
        .trim()
        .to_string();

    println!("cargo:rustc-env=HUNTIAN_VERSION={version}");
    println!("cargo:rustc-env=HUNTIAN_BETA_TAG=v{version}.beta");
    println!("cargo:rerun-if-changed=../VERSION");
}
