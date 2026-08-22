//! Static assets for the dashboard UI, compiled into the binary.
//!
//! `frontend/dist` is produced by `npm run build` (Vite). Embedding the whole
//! directory means a single self-contained binary — no nginx static root, no
//! copy steps, and hashed asset filenames guarantee cache correctness.

use axum::{
    http::{header, StatusCode},
    response::IntoResponse,
};
use include_dir::{include_dir, Dir};

static DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/frontend/dist");

/// Serve an embedded Vite bundle asset (`/assets/*`) with its real MIME type.
///
/// Returns 404 when the file is unknown; callers keep their SPA fallback for
/// everything else. Content-Type is derived from the file extension — never
/// guessed from contents — so `nosniff` stays fully enforced.
pub async fn asset(uri: axum::http::Uri) -> impl IntoResponse {
    // Strip the leading '/' and reject anything that escapes the dist tree
    // (absolute segments, Windows separators, traversal).
    let path = uri.path().trim_start_matches('/');
    if path.is_empty()
        || path.contains('\\')
        || path
            .split('/')
            .any(|seg| seg == ".." || seg.starts_with('.'))
    {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    }

    match DIST.get_file(path) {
        Some(file) => {
            let mime = mime_guess::from_path(path)
                .first_raw()
                .unwrap_or("application/octet-stream");
            let body = file.contents();
            (
                [
                    (header::CONTENT_TYPE, mime.to_string()),
                    (
                        header::CACHE_CONTROL,
                        "public, max-age=31536000, immutable".to_string(),
                    ),
                ],
                body,
            )
                .into_response()
        }
        None => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Recursive file search — `Dir::files()` is top-level-only.
    fn find_by_ext<'a>(dir: &'a Dir<'a>, ext: &str) -> Option<&'a include_dir::File<'a>> {
        dir.entries().iter().find_map(|e| match e {
            include_dir::DirEntry::File(f) if f.path().extension() == Some(ext.as_ref()) => Some(f),
            include_dir::DirEntry::Dir(d) => find_by_ext(d, ext),
            _ => None,
        })
    }

    #[tokio::test]
    async fn serves_js_bundle_as_javascript() {
        let js = find_by_ext(&DIST, "js").expect("vite build output must contain a JS bundle");
        let uri = format!("/{}", js.path().display()).parse().unwrap();
        let resp = asset(uri).await.into_response();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers()[header::CONTENT_TYPE],
            "text/javascript",
            "module scripts must not be served as text/html"
        );
    }

    #[tokio::test]
    async fn rejects_traversal() {
        for evil in ["/../Cargo.toml", "/src/main.rs", "/a\\..\\b", "/.gitignore"] {
            let uri: axum::http::Uri = evil.parse().unwrap();
            let resp = asset(uri).await.into_response();
            assert_eq!(resp.status(), StatusCode::NOT_FOUND, "{evil}");
        }
    }
}
