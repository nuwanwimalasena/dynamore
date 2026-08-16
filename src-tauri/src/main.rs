// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aws_client;
mod commands;

fn main() {
    tauri::Builder::default()
        .manage(aws_client::AwsClientState::new())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::auth_init_sso,
            commands::auth::auth_poll_sso_token,
            commands::auth::auth_list_sso_accounts,
            commands::auth::auth_list_sso_account_roles,
            commands::auth::auth_complete_sso_login,
            commands::auth::auth_login_with_keys,
            commands::auth::auth_logout,
            commands::auth::auth_get_session,
            commands::auth::auth_get_last_sso_config,
            commands::auth::auth_clear_sso_config,
            // Tables
            commands::tables::tables_list,
            commands::tables::tables_describe,
            commands::tables::tables_create,
            commands::tables::tables_delete,
            // Items
            commands::items::items_put,
            commands::items::items_get,
            commands::items::items_update,
            commands::items::items_delete,
            commands::items::items_batch_delete,
            // Query
            commands::query::query_query,
            commands::query::query_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
