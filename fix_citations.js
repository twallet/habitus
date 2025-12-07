const fs = require("fs");

const file = "frontend/src/utils/citations.ts";
let text = fs.readFileSync(file, "utf8");
const lines = text.split("\n");

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (
    line.includes('"') &&
    line.includes(" - ") &&
    line.trim().endsWith('",')
  ) {
    const dashPos = line.lastIndexOf(" - ");
    if (dashPos > 0) {
      const before = line.substring(0, dashPos);
      const after = line.substring(dashPos + 3);
      if (after.endsWith('",')) {
        const author = after.slice(0, -2);
        lines[i] = before + " (" + author + ')",';
      }
    }
  }
}

fs.writeFileSync(file, lines.join("\n"));
console.log("Fixed!");
