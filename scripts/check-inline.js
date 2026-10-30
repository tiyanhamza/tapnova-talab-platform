const fs = require("fs");
const vm = require("vm");

for (const file of ["public/index.html", "public/admin.html", "public/waiter.html", "public/admin-waiters.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) throw new Error(`No inline script found in ${file}`);
  scripts.forEach((match, index) => {
    new vm.Script(match[1], { filename: `${file}#script-${index + 1}` });
  });
  process.stdout.write(`Checked ${file}: ${scripts.length} inline script(s)\n`);
}
