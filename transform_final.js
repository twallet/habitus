const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "frontend",
  "src",
  "utils",
  "citations.ts"
);
const content = fs.readFileSync(filePath, "utf8");

// Simple replacement using string replace with a callback
let transformed = content.replace(
  /"([^"]+)\s+-\s+([^"]+)(",)/g,
  (match, quote, author, closing) => {
    return `"${quote} (${author})${closing}`;
  }
);

fs.writeFileSync(filePath, transformed);
console.log("Done!");
