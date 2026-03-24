# siyuan-imageConverter

[中文文档](./README_zh_CN.md)

`siyuan-imageConverter` is a SiYuan plugin for batch processing image resources in the current document. It supports image compression/conversion and structured archiving to keep your assets organized.

## Features

- Batch process images in the current document
- Optional image compression (`webp` / `avif`)
- Resource archiving by notebook + document path
- Optional deletion of original images
- Bilingual UI (`zh_CN` / `en_US`)
- Local resources only (skip `http/https/data/file://`)

## How To Use

1. Open any document and click the plugin icon in the top-right corner.
2. Choose an action from the menu:
   - `Convert Images`: Run conversion/compression based on current settings.
   - `Archive Images`: Archive only, without compression.

## Settings

- `Enable Image Compression`  
  When enabled, images are compressed before being written back or archived. When disabled, only organization/archiving is performed.

- `Output Format`  
  Compressed output format: `webp` or `avif`.

- `Resource Archiving`  
  When enabled, images are archived into `assets/...` based on notebook + document path.  
  When disabled, converted images are saved in the original image directory.

- `Delete Original Images`  
  Controls whether original images are deleted after processing.  
  When `Resource Archiving` is enabled, this option is locked on (archiving is effectively a move operation).

## Notes

- Processing scope is the currently active document.
- Back up important assets before running batch operations.
- After first install or major setting changes, switch documents once before batch processing.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Credits

- Inspired by [obsidian-image-converter](https://github.com/xRyul/obsidian-image-converter)
- Thanks to SiYuan plugin ecosystem and templates.

