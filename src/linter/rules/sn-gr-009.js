import { isStringLiteral } from '../ast.js';
import { callsNamed, describeTable, GET_METHODS } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

// Fields that routinely hold the same value on many records.
const NON_UNIQUE_FIELDS = new Set([
  'active',
  'state',
  'incident_state',
  'priority',
  'impact',
  'urgency',
  'severity',
  'category',
  'subcategory',
  'type',
  'stage',
  'approval',
  'contact_type',
  'assignment_group',
  'assigned_to',
  'caller_id',
  'opened_by',
  'requested_for',
  'company',
  'location',
  'department',
  'manager',
  'parent',
  'cmdb_ci',
  'short_description',
  'description',
  'close_code',
  'sys_class_name',
  'sys_created_by',
  'sys_updated_by',
  'sys_domain'
]);

export default {
  id: 'SN-GR-009',
  name: 'get() on a non-unique field',
  category: 'servicenow',
  severity: 'warning',
  description: "get(field, value) on a field such as state or assigned_to returns an arbitrary one of many matching records.",
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          for (const call of callsNamed(instance, GET_METHODS)) {
            const [field] = call.args;
            if (call.args.length < 2 || !isStringLiteral(field) || !NON_UNIQUE_FIELDS.has(field.value)) {
              continue;
            }
            context.report({
              node: call.node,
              confidence: 0.85,
              message: `${instance.name}.get('${field.value}', ...) matches many records in ${describeTable(instance)}; it returns whichever the database finds first.`,
              explanation: `get() loads a single record. '${field.value}' is not unique, so which record you get is undefined and can change between runs or after an upgrade.`,
              recommendation: 'Look the record up by a unique field (sys_id, number, user_name), or use addQuery() with orderBy() and setLimit(1) so the choice is explicit.'
            });
          }
        }
      }
    };
  }
};
