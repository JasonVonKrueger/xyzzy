// Knowledge base of globals that ServiceNow scripts reference, keyed by the identifier as it appears in
// code. Extend this map to teach the linter about additional APIs.
//
//   side    where the API exists at runtime: 'server', 'client', or 'both'
//   signal  whether a reference is strong evidence of the script's side when inferring execution
//           context (generic browser globals and APIs that exist on both sides are not)
//   api     display name used in findings
//   clientAlternative  what to do instead when a server-only API is used in client code

const USE_GLIDE_AJAX =
  'Move this logic into a client-callable Script Include and call it with asynchronous GlideAjax (getXMLAnswer).';

function server(api, clientAlternative = USE_GLIDE_AJAX) {
  return { side: 'server', signal: true, api, clientAlternative };
}

function client(api, signal = true) {
  return { side: 'client', signal, api };
}

export const SERVICENOW_GLOBALS = new Map(
  Object.entries({
    // Server-side
    gs: server(
      'GlideSystem (gs)',
      'Use g_user for details about the current user (g_user.userID, g_user.hasRole()), or fetch server data with asynchronous GlideAjax.'
    ),
    current: server(
      'current (the record being processed)',
      'Use g_form.getValue() and g_form.setValue() to work with the record shown on the form.'
    ),
    previous: server(
      'previous (the record before the change)',
      'In an onChange Client Script use the oldValue parameter; otherwise pass the value from the server with g_scratchpad in a display Business Rule.'
    ),
    GlideRecordSecure: server('GlideRecordSecure'),
    GlideAggregate: server('GlideAggregate'),
    GlideQuery: server('GlideQuery'),
    GlideDateTime: server(
      'GlideDateTime',
      'Use g_user_date_time_format / g_user_date_format with client-side date handling, or compute the value on the server with GlideAjax.'
    ),
    GlideDate: server('GlideDate'),
    GlideTime: server('GlideTime'),
    GlideDuration: server('GlideDuration'),
    GlideSchedule: server('GlideSchedule'),
    GlideElement: server('GlideElement'),
    GlideSysAttachment: server('GlideSysAttachment'),
    GlideTableHierarchy: server('GlideTableHierarchy'),
    GlideEvaluator: server('GlideEvaluator'),
    GlideScopedEvaluator: server('GlideScopedEvaluator'),
    GlideEncrypter: server('GlideEncrypter'),
    GlideStringUtil: server('GlideStringUtil'),
    GlideSecureRandomUtil: server('GlideSecureRandomUtil'),
    GlideEmailOutbound: server('GlideEmailOutbound'),
    GlideHTTPRequest: server('GlideHTTPRequest'),
    RESTMessageV2: server('RESTMessageV2'),
    SOAPMessageV2: server('SOAPMessageV2'),
    sn_ws: server('sn_ws (outbound web services)'),
    sn_fd: server('sn_fd (Flow Designer API)'),
    AbstractAjaxProcessor: server('AbstractAjaxProcessor'),
    $sp: server('$sp (Service Portal server API)', 'Move this into the widget server script and expose the result through the data object.'),

    // Client-side
    g_form: client('GlideForm (g_form)'),
    g_user: client('GlideUser (g_user)'),
    g_list: client('GlideList (g_list)'),
    g_menu: client('g_menu'),
    g_item: client('g_item'),
    g_navigation: client('g_navigation'),
    g_i18n: client('g_i18n'),
    GlideAjax: client('GlideAjax'),
    GlideDialogWindow: client('GlideDialogWindow'),
    GlideModal: client('GlideModal'),
    GlideModalForm: client('GlideModalForm'),
    spUtil: client('spUtil'),
    spModal: client('spModal'),
    window: client('window', false),
    document: client('document', false),
    jQuery: client('jQuery', false),
    $j: client('jQuery ($j)', false),

    // Both sides (behavior differs)
    GlideRecord: { side: 'both', signal: false, api: 'GlideRecord' },
    g_scratchpad: { side: 'both', signal: false, api: 'g_scratchpad' },
    Class: { side: 'both', signal: false, api: 'Class' }
  })
);
