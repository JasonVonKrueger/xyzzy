const MAX_LISTED = 5;

// Every declared name in the file, with the definition that introduced it. Implicit bindings
// (`arguments`) and imports (named by another module) are excluded.
export function declaredIdentifiers(scopes) {
  const declared = [];
  for (const scope of scopes.scopes) {
    for (const variable of scope.variables.values()) {
      const def = variable.defs.find((candidate) => candidate.identifier && candidate.kind !== 'import');
      if (def) {
        declared.push({ name: variable.name, def, identifier: def.identifier });
      }
    }
  }
  return declared.sort((a, b) => a.identifier.start - b.identifier.start);
}

// "a (line 3), b (line 7), and 4 more"
export function listNames(entries) {
  const listed = entries.slice(0, MAX_LISTED).map(({ name, identifier }) => `${name} (line ${identifier.loc.start.line})`);
  const rest = entries.length - listed.length;
  return rest > 0 ? `${listed.join(', ')}, and ${rest} more` : listed.join(', ');
}
