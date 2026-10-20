import { check } from './shared.mjs';

const projects = process.argv.slice(2);
for (const project of projects.length ? projects : ['tsconfig.json']) {
  check(process.cwd(), project);
}
