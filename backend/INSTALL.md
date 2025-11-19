# Backend Installation Guide

## Installing Dependencies

The backend uses `better-sqlite3` which requires native compilation on Windows. You have two options:

### Option 1: Install Visual Studio Build Tools (Recommended)

1. Download Visual Studio Build Tools:

   - Go to: https://visualstudio.microsoft.com/downloads/
   - Scroll down to "Tools for Visual Studio" section
   - Download "Build Tools for Visual Studio 2022"

2. Run the installer and select:

   - **Desktop development with C++** workload
   - Make sure "MSVC v143 - VS 2022 C++ x64/x86 build tools" is checked
   - Make sure "Windows 10/11 SDK" is checked

3. After installation, restart your terminal/PowerShell

4. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

### Option 2: Use Pre-built Binaries (Alternative)

If you can't install Build Tools, you can try:

1. Install windows-build-tools globally (deprecated but may work):

   ```bash
   npm install -g windows-build-tools
   ```

2. Or use an alternative SQLite library that doesn't require compilation:
   - Consider using `sql.js` or `sqlite3` instead of `better-sqlite3`
   - Note: This would require code changes

### Option 3: Use WSL (Windows Subsystem for Linux)

If you have WSL installed:

1. Open WSL terminal
2. Navigate to your project
3. Install dependencies (no compilation needed in Linux):
   ```bash
   cd backend
   npm install
   ```

## Verifying Installation

After installing dependencies, verify everything works:

```bash
# Run tests
npm test

# Start development server
npm run dev
```

## Troubleshooting

### Error: "Cannot find Visual Studio installation"

- Make sure Visual Studio Build Tools is installed
- Restart your terminal after installation
- Try running: `npm config set msvs_version 2022`

### Error: "Python not found"

- Visual Studio Build Tools includes Python, but you can also install it separately
- Make sure Python is in your PATH

### Still having issues?

- Check Node.js version: `node -v` (should be 18+)
- Check npm version: `npm -v`
- Try clearing npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then reinstall
