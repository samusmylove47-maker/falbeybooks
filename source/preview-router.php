<?php
// Local preview only. Never copy source/ into the public website directory.
$root = realpath(__DIR__ . '/../public');
$request = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (preg_match('~^/__review/social/(general|sd-0[1-8]|hidden-dragons)/$~', $request, $match) && is_file(__DIR__ . '/social/' . $match[1] . '.html')) {
    header('Content-Type: text/html; charset=UTF-8'); readfile(__DIR__ . '/social/' . $match[1] . '.html'); return true;
}
if (preg_match('~(?:^|/)(?:\.|form-submissions\.txt)|(?:^|/)error_log$|\.(?:log|ini|toml|bak|sql)$~i', $request)) {
    http_response_code(403); echo 'Forbidden'; return true;
}
$file = realpath($root . $request);
if ($file !== false && ($file === $root || str_starts_with($file, $root . DIRECTORY_SEPARATOR))) {
    if (is_file($file)) return false;
    if (is_dir($file) && is_file($file . '/index.html')) {
        if (!str_ends_with($request, '/')) { header('Location: ' . $request . '/', true, 301); return true; }
        header('Content-Type: text/html; charset=UTF-8'); readfile($file . '/index.html'); return true;
    }
}
http_response_code(404); header('Content-Type: text/html; charset=UTF-8'); readfile($root . '/404.html');
