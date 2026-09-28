import { RuleRegistry } from '../rule-registry.js';

import cplx001 from './cplx-001.js';
import cplx002 from './cplx-002.js';
import cplx003 from './cplx-003.js';
import cplx004 from './cplx-004.js';
import cplx005 from './cplx-005.js';
import int001 from './int-001.js';
import int002 from './int-002.js';
import int003 from './int-003.js';
import jsCond001 from './js-cond-001.js';
import jsCond002 from './js-cond-002.js';
import jsDup001 from './js-dup-001.js';
import jsDup002 from './js-dup-002.js';
import jsDup003 from './js-dup-003.js';
import jsErr001 from './js-err-001.js';
import jsErr002 from './js-err-002.js';
import jsErr003 from './js-err-003.js';
import jsErr004 from './js-err-004.js';
import jsErr005 from './js-err-005.js';
import jsExpr001 from './js-expr-001.js';
import jsFormat001 from './js-format-001.js';
import jsFormat002 from './js-format-002.js';
import jsFormat003 from './js-format-003.js';
import jsFormat004 from './js-format-004.js';
import jsFormat005 from './js-format-005.js';
import jsFunc001 from './js-func-001.js';
import jsGlobal001 from './js-global-001.js';
import jsNaming001 from './js-naming-001.js';
import jsNaming002 from './js-naming-002.js';
import jsShadow001 from './js-shadow-001.js';
import jsSyntax001 from './js-syntax-001.js';
import jsUndef001 from './js-undef-001.js';
import jsUnreach001 from './js-unreach-001.js';
import jsUnused001 from './js-unused-001.js';
import port001 from './port-001.js';
import port002 from './port-002.js';
import port003 from './port-003.js';
import port004 from './port-004.js';
import sec001 from './sec-001.js';
import sec002 from './sec-002.js';
import sec003 from './sec-003.js';
import sec004 from './sec-004.js';
import sec005 from './sec-005.js';
import sec006 from './sec-006.js';
import sec007 from './sec-007.js';
import sec008 from './sec-008.js';
import snBr001 from './sn-br-001.js';
import snBr002 from './sn-br-002.js';
import snBr003 from './sn-br-003.js';
import snBr004 from './sn-br-004.js';
import snBr005 from './sn-br-005.js';
import snBr006 from './sn-br-006.js';
import snBr007 from './sn-br-007.js';
import snBr008 from './sn-br-008.js';
import snAjax001 from './sn-ajax-001.js';
import snAjax002 from './sn-ajax-002.js';
import snAjax003 from './sn-ajax-003.js';
import snAjax004 from './sn-ajax-004.js';
import snClient001 from './sn-client-001.js';
import snClient002 from './sn-client-002.js';
import snClient003 from './sn-client-003.js';
import snClient004 from './sn-client-004.js';
import snClient005 from './sn-client-005.js';
import snClient006 from './sn-client-006.js';
import snGr001 from './sn-gr-001.js';
import snGr002 from './sn-gr-002.js';
import snGr003 from './sn-gr-003.js';
import snGr004 from './sn-gr-004.js';
import snGr005 from './sn-gr-005.js';
import snGr006 from './sn-gr-006.js';
import snGr007 from './sn-gr-007.js';
import snGr008 from './sn-gr-008.js';
import snGr009 from './sn-gr-009.js';
import snGr010 from './sn-gr-010.js';
import snGr011 from './sn-gr-011.js';

// Built-in rules. Add new rule modules here; the registry validates each one on load.
export const BUILT_IN_RULES = [
  // Phase 1
  jsSyntax001,
  jsFormat001,
  sec001,
  snClient001,
  // Phase 2 — core JavaScript: correctness
  jsUndef001,
  jsGlobal001,
  jsUnused001,
  jsUnreach001,
  jsDup001,
  jsDup002,
  jsDup003,
  jsCond001,
  jsCond002,
  jsExpr001,
  jsFunc001,
  jsShadow001,
  // Phase 2 — error handling
  jsErr001,
  jsErr002,
  jsErr003,
  jsErr004,
  jsErr005,
  // Phase 2 — naming
  jsNaming001,
  jsNaming002,
  // Phase 3 — GlideRecord
  snGr001,
  snGr002,
  snGr003,
  snGr004,
  snGr005,
  snGr006,
  snGr007,
  snGr008,
  snGr009,
  snGr010,
  snGr011,
  // Phase 4 — Business Rules
  snBr001,
  snBr002,
  snBr003,
  snBr004,
  snBr005,
  snBr006,
  snBr007,
  snBr008,
  // Phase 5 — client scripts and GlideAjax
  snClient002,
  snClient003,
  snClient004,
  snClient005,
  snClient006,
  snAjax001,
  snAjax002,
  snAjax003,
  snAjax004,
  // Phase 6 — security
  sec002,
  sec003,
  sec004,
  sec005,
  sec006,
  sec007,
  sec008,
  // Phase 7 — integrations and portability
  int001,
  int002,
  int003,
  port001,
  port002,
  port003,
  port004,
  // Phase 8 — complexity
  cplx001,
  cplx002,
  cplx003,
  cplx004,
  cplx005,
  // Phase 9 — formatting fixers
  jsFormat002,
  jsFormat003,
  jsFormat004,
  jsFormat005
];

export function createDefaultRegistry() {
  return new RuleRegistry(BUILT_IN_RULES);
}
