#!/bin/bash
cat << 'INNEREOF' > patch.js
const fs = require('fs');
let code = fs.readFileSync('lib/api-error.ts', 'utf8');
code = code.replace(
  `  const response: ApiErrorResponse = {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
  };`,
  `  const response: ApiErrorResponse = {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
    },
  };
  
  if (details !== undefined) {
    response.error.details = details;
  }`
);
fs.writeFileSync('lib/api-error.ts', code);
INNEREOF
node patch.js
rm patch.js
