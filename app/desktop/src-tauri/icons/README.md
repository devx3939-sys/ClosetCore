Place app icons here before building. The easiest way is to use the Tauri CLI:

```
npx @tauri-apps/cli icon path/to/your-1024x1024.png
```

That command generates every required size and format (32x32.png, 128x128.png,
128x128@2x.png, icon.icns, icon.ico) into this folder.

Until you do, `npm run tauri build` will fail because the icon files don't exist
yet. `npm run tauri dev` works without icons in some cases but it's safest to
generate them first.
