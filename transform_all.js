const fs = require("fs");

const file = "frontend/src/utils/citations.ts";
const content = fs.readFileSync(file, "utf8");

// Replace all occurrences of: text - author in quotes
let result = content;
let count = 0;

// Process each line
const lines = content.split("\n");
const newLines = lines.map((line) => {
  if (line.includes(" - ")) {
    const lastDash = line.lastIndexOf(" - ");
    if (lastDash > 0) {
      const before = line.substring(0, lastDash);
      const after = line.substring(lastDash + 3);

      // Check if this looks like a citation line
      if (
        before.includes('"') &&
        (after.includes('",') || after.trim() === '"')
      ) {
        const authorEnd = after.indexOf('",');
        if (authorEnd > 0) {
          const author = after.substring(0, authorEnd);
          const rest = after.substring(authorEnd);
          count++;
          return before + " (" + author + ")" + rest;
        }
      }
    }
  }
  return line;
});

fs.writeFileSync(file, newLines.join("\n"));
console.log(`Transformed ${count} citations`);
