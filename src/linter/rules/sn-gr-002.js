import { createMassWriteRule } from './sn-gr-001.js';

export default createMassWriteRule({
  id: 'SN-GR-002',
  method: 'deleteMultiple',
  name: 'Unrestricted deleteMultiple',
  verb: 'deletes',
  consequence:
    'every record in the table is deleted, along with cascading deletes of related records. Recovery means a restore or the Delete Recovery module, if it is still in time.'
});
