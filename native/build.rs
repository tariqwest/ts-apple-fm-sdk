// native/build.rs
use std::{env, path::Path};

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("no CARGO_MANIFEST_DIR");
    let build_dir = Path::new(&manifest_dir).join("../build");
    println!("cargo:rustc-link-search=native={}", build_dir.display());

    // Link against libFoundationModels.dylib
    println!("cargo:rustc-link-lib=dylib=FoundationModels");

    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-arg=-Wl,-rpath,@loader_path");
        println!("cargo:rustc-link-arg=-undefined");
        println!("cargo:rustc-link-arg=dynamic_lookup");
    }
}
