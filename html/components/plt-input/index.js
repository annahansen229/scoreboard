(function () {
  const gameId = _windowFunctions.getParam('game');
  const prefix = gameId ? 'ScoreBoard.Game(' + gameId + ').' : 'ScoreBoard.CurrentGame.';

  WS.Register([prefix + 'Rule(Penalties.NumberToFoulout)']);
  WS.Register([prefix + 'Clock(Period).Number'], _pltUpdateCurrentPeriodStyle);
  WS.Register([prefix + 'Clock(Jam).Number'], _pltUpdateCurrentJamStyle);
  WS.Register(prefix + 'Team(*).Skater(*).Role', {
    triggerBatchFunc: function () {
      $('.PltInput>.Team').each(function (i, e) {
        $(e)
          .find('tr.Skater:not([role="NotInGame"]), tr.NonSkater:not(.sbHide)')
          .each(function (idx) {
            $(this).toggleClass('Darker', idx % 4 === 2 || idx % 4 === 3);
          });
      });
    },
  });

  WS.Register([
    prefix + 'Team(*).Skater(*).Name',
    prefix + 'Period(*).CurrentJam',
    prefix + 'CurrentPeriodNumber',
    prefix + 'Period(*).CurrentJamNumber',
    prefix + 'Team(*).Skater(*).Position',
    prefix + 'Team(*).Position(*)',
    prefix + 'Team(*).AllBlockersSet',
  ]);
})();

function _pltGetFieldingPrefix(gameId, teamId, skaterId) {
  var position = WS.state['ScoreBoard.Game(' + gameId + ').Team(' + teamId + ').Skater(' + skaterId + ').Position'];
  position = position.slice(position.lastIndexOf('_') + 1);
  var fieldingPrefix = ').TeamJam(' + teamId + ').Fielding(' + position + ')';
  if (
    isTrue(WS.state['ScoreBoard.Game(' + gameId + ').InJam']) ||
    isTrue(WS.state['ScoreBoard.Game(' + gameId + ').Team(' + teamId + ').FieldingAdvancePending'])
  ) {
    fieldingPrefix =
      'ScoreBoard.Game(' +
      gameId +
      ').Period(' +
      WS.state['ScoreBoard.Game(' + gameId + ').CurrentPeriodNumber'] +
      ').Jam(' +
      WS.state['ScoreBoard.Game(' + gameId + ').Period(' + WS.state['ScoreBoard.Game(' + gameId + ').CurrentPeriodNumber'] + ').CurrentJamNumber'] +
      fieldingPrefix;
  } else {
    fieldingPrefix = 'ScoreBoard.Game(' + gameId + ').Jam(' + WS.state['ScoreBoard.Game(' + gameId + ').UpcomingJamNumber'] + fieldingPrefix;
  }
  return fieldingPrefix;
}

function pltMaySub(k) {
  return isTrue(WS.state[k.upTo('Skater') + '.PenaltyBox']) || isTrue(WS.state[k.upTo('Skater') + '.HasUnserved']);
}

function _pltSetRole(k, role, ignoreIneligible, ignoreRoleChange) {
  const oldRole = WS.state[k + '.Role'];
  if (oldRole === 'Ineligible' && !ignoreIneligible) {
    _pltOpenIneligibleDialog(k, role);
  } else if (pltMaySub(k) && !ignoreRoleChange) {
    _pltOpenNoRoleChangeDialog(k, role);
  } else if (
    (role === 'Jammer' || role === 'Pivot') &&
    (isTrue(WS.state[k.upTo('Team') + '.Position(' + role + ').PenaltyBox']) ||
      isTrue(WS.state[k.upTo('Team') + '.Position(' + role + ').HasUnserved']))
  ) {
    _pltOpenSubstituteDialog(k, role);
  } else if (
    ((role === 'Blocker' && oldRole !== 'Pivot') || (role === 'Pivot' && isTrue(WS.state[k.upTo('Team') + '.NoPivot']))) &&
    isTrue(WS.state[k.upTo('Team') + '.AllBlockersSet']) &&
    oldRole !== 'Blocker'
  ) {
    _pltOpenReplaceDialog(k, role);
  } else {
    WS.Set(k + '.Role', role);
  }
}

function pltSetJammer(k) {
  _pltSetRole(k, 'Jammer', false, false);
}

function pltSetPivot(k) {
  _pltSetRole(k, 'Pivot', false, false);
}

function pltSetBlocker(k) {
  _pltSetRole(k, 'Blocker', false, false);
}

function pltToBoxString(k, v) {
  return isTrue(v) ? '' : 'Box';
}

function pltToggleBox(k, v, elem) {
  const fieldingPath = _pltGetFieldingPrefix(k.Game, k.Team, k.Skater);
  if (elem.hasClass('Serving')) {
    WS.Set(k + '.PenaltyBox', false);
  } else if (WS.state[fieldingPath + '.CurrentBoxTrip'] == null || isTrue(WS.state[k + '.HasUnserved'])) {
    WS.Set(k + '.PenaltyBox', true);
  } else {
    pltOpenUnendDialog(fieldingPath);
  }
}

function pltAdvance(k, v, elem) {
  if (elem.hasClass('Show')) {
    WS.Set(k.upTo('Team') + '.AdvanceFieldings', true);
  }
}

function pltAnnotation(k, v, elem) {
  if (elem.hasClass('Show')) {
    _pltOpenAnnotationEditor(k.Game, k.Team, k.Skater);
  }
}

function pltAddPenalty(k) {
  _pltOpenPenaltyEditor(k.Game, k.Team, k.Skater, 99);
}

function pltEditPenalty(k) {
  _pltOpenPenaltyEditor(k.Game, k.Team, k.Skater, k.Penalty);
}

function pltToPeriodJam(k) {
  const prefix = k.upTo('Penalty');
  const pn = WS.state[prefix + '.PeriodNumber'];
  const jn = WS.state[prefix + '.JamNumber'];
  return pn && jn ? pn + '-' + jn : '\xa0';
}

function _pltUpdateCurrentPeriodStyle() {
  const prefix = _windowFunctions.getParam('game') ? 'ScoreBoard.Game(' + _windowFunctions.getParam('game') + ').' : 'ScoreBoard.CurrentGame.';
  const periodNumber = WS.state[prefix + 'Clock(Period).Number'];
  if (periodNumber == null) {
    return;
  }

  $('#current-period-style').remove();
  $('<style> .Penalty[period="' + periodNumber + '"] { font-weight: bold; color: #000; }</style>')
    .attr('id', 'current-period-style')
    .appendTo('head');

  _pltUpdateCurrentJamStyle();
}

function _pltUpdateCurrentJamStyle() {
  const prefix = _windowFunctions.getParam('game') ? 'ScoreBoard.Game(' + _windowFunctions.getParam('game') + ').' : 'ScoreBoard.CurrentGame.';
  const periodNumber = WS.state[prefix + 'Clock(Period).Number'];
  const jamNumber = WS.state[prefix + 'Clock(Jam).Number'];
  if (jamNumber == null || periodNumber == null) {
    return;
  }

  $('#current-jam-style').remove();
  $('<style> .Penalty[period="' + periodNumber + '"][jam="' + jamNumber + '"] { text-decoration: underline; } </style>')
    .attr('id', 'current-jam-style')
    .appendTo('head');
}

//###################################################################
//
//  Replace Dialog
//
//###################################################################

var pltReplacePath = '';
var pltReplaceTarget = '';

function _pltOpenReplaceDialog(k, pos) {
  pltReplacePath = k + '.Role';
  pltReplaceTarget = pos;
  WS.SetupDialog($('#BlockerReplaceDialog'), k, { modal: true, title: 'Replace Blocker', width: '400px' });
}

function pltFinishReplace(k, v, elem, event) {
  sbCloseDialog(k, v, elem, event);
  WS.Set(pltReplacePath, pltReplaceTarget);
}

//###################################################################
//
//  Ineligible Dialog
//
//###################################################################

var pltIneligiblePath = '';
var pltIneligibleTarget = '';

function _pltOpenIneligibleDialog(k, role) {
  pltIneligiblePath = k;
  pltIneligibleTarget = role;
  WS.SetupDialog($('#IneligibleDialog'), k, { modal: true, title: 'Ineligible Skater', width: '400px' });
}

function pltToIneligibleReason(k, v) {
  if (v == null) {
    return 'an injury calloff (or similar)';
  } else if (v === 'FO') {
    return 'a foulout';
  } else if (v === 'RE') {
    return 'removal for safety concerns';
  } else {
    return 'an expulsion';
  }
}

function pltIgnoreIneligible(k, v, elem, event) {
  sbCloseDialog(k, v, elem, event);
  _pltSetRole(pltIneligiblePath, pltIneligibleTarget, true, false);
}

//###################################################################
//
//  No Role Change Dialog
//
//###################################################################

var pltRoleChangePath = '';
var pltRoleChangeTarget = '';

function _pltOpenNoRoleChangeDialog(k, role) {
  pltRoleChangePath = k;
  pltRoleChangeTarget = role;
  WS.SetupDialog($('#NoRoleChangeDialog'), k, { modal: true, title: 'Role Change not Allowed', width: '400px' });
}

function pltIgnoreRoleChange(k, v, elem, event) {
  sbCloseDialog(k, v, elem, event);
  _pltSetRole(pltRoleChangePath, pltRoleChangeTarget, true, true);
}

//###################################################################
//
//  Substitute Dialog
//
//###################################################################

var pltSubstituteSkater = '';
var pltSubstituteTarget = '';

function _pltOpenSubstituteDialog(k, role) {
  pltSubstituteSkater = k.Skater;
  pltSubstituteTarget = ').TeamJam(' + k.Team + ').Fielding(' + role + ')';
  if (isTrue(WS.state['ScoreBoard.Game(' + k.Game + ').InJam']) || isTrue(WS.state[k.upTo('Team') + '.FieldingAdvancePending'])) {
    pltSubstituteTarget =
      k.upTo('Game') +
      '.Period(' +
      WS.state[k.upTo('Game') + '.CurrentPeriodNumber'] +
      ').Jam(' +
      WS.state[k.upTo('Game') + '.Period(' + WS.state[k.upTo('Game') + '.CurrentPeriodNumber'] + ').CurrentJamNumber'] +
      pltSubstituteTarget;
  } else {
    pltSubstituteTarget = k.upTo('Game') + '.Jam(' + WS.state[k.upTo('Game') + '.UpcomingJamNumber'] + pltSubstituteTarget;
  }
  WS.SetupDialog($('#SubstituteDialog'), pltSubstituteTarget, { modal: true, title: 'Substitute Skater?', width: '400px' });
}

function pltToPosition(k) {
  return k.Fielding;
}

function pltDoSubstitute(k, v, elem, event) {
  sbCloseDialog(k, v, elem, event);
  console.log(pltSubstituteTarget, pltSubstituteSkater);
  WS.Set(pltSubstituteTarget + '.Skater', pltSubstituteSkater, 'change');
}

//###################################################################
//
//  Unend Dialog
//
//###################################################################

function pltOpenUnendDialog(k) {
  WS.SetupDialog($('#UnendDialog'), k, {
    modal: true,
    title: 'Continue Box Trip?',
    width: '400px',
    buttons: {
      Cancel: function () {
        $(this).dialog('close');
      },
    },
  });
}

//###################################################################
//
//  Penalty Editor
//
//###################################################################

function _pltOpenPenaltyEditor(g, t, s, p) {
  if (!g) {
    return; // Whiteboard
  }
  var prefix = 'ScoreBoard.Game(' + g + ').Team(' + t + ')';
  const teamName = WS.state[prefix + '.AlternateName(plt)'] || WS.state[prefix + '.UniformColor'] || WS.state[prefix + '.Name'];
  prefix = 'ScoreBoard.Game(' + g + ').Team(' + t + ').Skater(' + s + ')';
  const skaterName = WS.state[prefix + '.Name'];
  const skaterNumber = WS.state[prefix + '.RosterNumber'];

  p = Number(p);
  while (!isNaN(p) && p > 1 && WS.state[prefix + '.Penalty(' + (p - 1) + ').Code'] == null) {
    p--;
  }

  WS.SetupDialog($('#PenaltyEditor'), prefix + '.Penalty(' + p + ')', {
    modal: true,
    title: teamName + ' ' + skaterNumber + ' (' + skaterName + ')',
    width: Math.min(1200, 0.9 * window.innerWidth),
  });
}

function pltCurrentIfNull(k, v) {
  return v || WS.state['ScoreBoard.Game(' + k.Game + ').CurrentPeriodNumber'];
}

function pltCurrentIfInvalid(k, v, elem) {
  return elem.children('[value="' + v + '"]').length
    ? v
    : WS.state[k.upTo('Period') + '.CurrentJam'] ||
        WS.state['ScoreBoard.Game(' + k.Game + ').Period(' + WS.state['ScoreBoard.Game(' + k.Game + ').CurrentPeriodNumber'] + ').CurrentJam'];
}

function pltIsThisPeriod(k, v, elem) {
  return (
    (v != null && v != elem.attr('Period')) || (v == null && WS.state['ScoreBoard.Game(' + k.Game + ').CurrentPeriodNumber'] != elem.attr('Period'))
  );
}

function pltAdjust(k, v, elem) {
  const dir = elem.attr('dir');
  elem.siblings('select').find(':selected')[dir]().prop('selected', true).parent().trigger('change');
}

function pltUpdateJam(k, v) {
  WS.Set(k.upTo('Penalty') + '.Jam', WS.state['ScoreBoard.Game(' + k.Game + ').Period(' + v + ').CurrentJam']);
  return v;
}

function pltIsFoExp(k) {
  return k.Penalty == 0;
}

function pltIsNotFoExp(k) {
  return k.Penalty != 0;
}

function pltToPenaltyCodeDisplay(k, v, elem, suffix) {
  suffix = suffix || '';
  var output = '<div class="Code">' + k.PenaltyCode + suffix + '</div><div class="Description">';
  v.split(',').forEach(function (d) {
    output = output + '<div>' + d + '</div>';
  });
  output = output + '</div>';
  return output;
}

function pltToExpCodeDisplay(k, v, elem) {
  return pltToPenaltyCodeDisplay(k, v, elem, ' (EXP)');
}

function pltCloseDialogOnPenaltySelection(k, v, elem, event) {
  // close the dialog on selection if:
  //  Called By Tracking is disabled, or
  //  the CallingPosition has also been set
  const penaltyPath = _penaltyPathFromElem(elem);
  if (!$('body').is('[calledBy]') || WS.state[penaltyPath + '.CallingPosition']) {
    sbCloseDialog(k, v, elem, event);
  }
}

//###################################################################
//
//  Called By Editor
//
//###################################################################
const DEFAULT_CALLED_BY_POSITIONS = ["IPRF", "IPRR", "JR1", "JR2", "OPRF", "OPRM", "OPRR", "PLT1", "PLT2", "PBM"]

function pltToggleReassign(k, v, elem) {
  // toggles the ability to edit the officials assigned to the positions of the default positions
  elem.closest('.CalledBy').toggleClass('Reassign');
  elem.toggleClass('sbActive', elem.closest('.CalledBy').hasClass('Reassign'));
}

function _assignCaller(penaltyPath, callingPosition, callingOfficial) {
  WS.Set(penaltyPath + '.CallingPosition', callingPosition);
  WS.Set(penaltyPath + '.CallingOfficial', callingOfficial);
}

function _getPositionShortNameFromPositionID(officialPositionID) {
  // extracts the short name (such as IPRR) from the officialPositionID
  return officialPositionID ? officialPositionID.split('_').pop() : '';
}

function _getOfficialIDFromOfficialPositionShortName(game, positionShortName) {
  // looks up the ID of the Official currently assigned to the OfficialPosition
  return WS.state['ScoreBoard.Game(' + game + ').OfficialPosition(' + positionShortName + ').CurrentOfficial'] || null;
}

function _callingOfficialIsAssignedToCallingPosition (game, penaltyPath) {
  const callingPositionID = WS.state[penaltyPath + '.CallingPosition']
  const callingOfficialID = WS.state[penaltyPath + '.CallingOfficial']
  const callingPositionShortName = _getPositionShortNameFromPositionID(callingPositionID)
  const officialAssignedToPositionID = _getOfficialIDFromOfficialPositionShortName(game, callingPositionShortName) || null
  return Boolean(callingPositionID) && officialAssignedToPositionID == callingOfficialID
}

function _penaltyPathFromElem(elem) {
  // navigates the context heirarchy to get the Penalty context
  return elem.closest('#PenaltyEditor').attr('sbContext').replace(/^\//, '');
}

function _closeDialogOnPositionSelection(k, v, elem, event) {
  // Ignore clicks inside .OnEdit (propagated from position editing controls) and keep the current value
  if (event && $(event.target).closest('.OnEdit').length) {
    return;
  }
  
  // close the dialog if the penalty code has also been assigned
  const penaltyPath = _penaltyPathFromElem(elem);
  if (WS.state[penaltyPath + '.Code']) {
    sbCloseDialog(k, v, elem, event);
  }
}

function pltToCalledByDisplay(k) {
  // generates the Position: Name label for the read-only "Called By" field
  const penaltyPath = k.upTo('Penalty');
  const gamePath = k.upTo('Game');

  const positionShortName = _getPositionShortNameFromPositionID(WS.state[penaltyPath + '.CallingPosition']);
  const positionName = positionShortName ? WS.state[gamePath + '.OfficialPosition(' + positionShortName + ').Name'] : '';

  const officialId = WS.state[penaltyPath + '.CallingOfficial'];
  const officialName = officialId
    ? WS.state[gamePath + '.Nso(' + officialId + ').Name'] || WS.state[gamePath + '.Ref(' + officialId + ').Name']
    : '';

  if (positionName && officialName) {
    return positionName + ' : ' + officialName;
  }
  return positionName || officialName || '';
}

//###################################################################
// Default OfficialPositions 
//###################################################################
function pltIsDefaultOfficialPositionActive (k, v, elem) {
  // Default section is active when:
  //  the CallingPosition is one of the default positions, and  
  //  the CallingOfficial matches the CurrentOfficial of the CallingPosition
  const penaltyPath = _penaltyPathFromElem(elem);

  const divPositionShortName = elem.attr('OfficialPosition');
  const divPositionID = k.Game + '_' + divPositionShortName;
  const divPositionIsDefaultPosition = DEFAULT_CALLED_BY_POSITIONS.includes(divPositionShortName)
  
  const divIDMatchesCallingPositionID = divPositionID == WS.state[penaltyPath + '.CallingPosition']

  return divPositionIsDefaultPosition && divIDMatchesCallingPositionID && _callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath)
}

function pltToggleDefaultOfficialPosition(k, v, elem, event) {
  // Handles a click in a default position
  // When the div has class sbActive, it clears the assignment.
  // Otherwise, it sets the assignment.

  if (event && $(event.target).closest('.OnEdit').length) {
    // Ignore clicks inside .OnEdit (propagated from position editing controls)
    return;
  }

  const positionShortName = elem.attr('OfficialPosition');
  const penaltyPath = _penaltyPathFromElem(elem);
  const callingPositionID = k.Game + '_' + positionShortName;
  const callingOfficialID = _getOfficialIDFromOfficialPositionShortName(k.Game, positionShortName);

  if (elem.hasClass('sbActive')) {
    _assignCaller(penaltyPath, null, null);
  } else {
    _assignCaller(penaltyPath, callingPositionID, callingOfficialID);
  }

  _closeDialogOnPositionSelection(k, v, elem, event);
}

//###################################################################
// Other OfficialPositions 
//###################################################################
function pltGetOtherOfficialOptionText(k) {
  // generates the Position: Official labels for the 'Other' select control
  const positionPath = k.substring(0, k.lastIndexOf('.'));
  const positionName = WS.state[positionPath + '.Name'];
  const currentOfficialName = WS.state[positionPath + '.CurrentOfficialName'];
  if (positionName && currentOfficialName) {
    return positionName + ': ' + currentOfficialName;
  }
  return positionName || currentOfficialName || '';
}

function pltIsOtherOfficialPositionOptionSelectedInitialValue(k, v, elem) {
  // option is selected when:
  //  it's value matches the CallingPosition, and
  //  the CallingOfficial matches the CurrentOfficial of the CallingPosition
  const penaltyPath = _penaltyPathFromElem(elem);
  const thisOptionValue = elem.attr('value')
  const callingPositionID = WS.state[penaltyPath + '.CallingPosition']
  return (thisOptionValue == callingPositionID) && _callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath)
}

function isOtherOfficialPositionActive (k, v, elem) {
  // Other section is active when:
  //  the CallingPosition is not one of the default positions, and 
  //  the CallingOfficial matches the CurrentOfficial of the CallingPosition
  const penaltyPath = _penaltyPathFromElem(elem);
  const callingOfficialIsAssignedtoCallingPosition = _callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath)
  const callingPositionIsDefaultPosition = DEFAULT_CALLED_BY_POSITIONS.includes(_getPositionShortNameFromPositionID(WS.state[penaltyPath + '.CallingPosition']))
  return !callingPositionIsDefaultPosition && callingOfficialIsAssignedtoCallingPosition
}

function pltSelectOtherOfficialPosition(k, callingPositionID, elem, event) {
  // handles a selection change in the Other input
  // an empty selection clears the assignment
  // a non-empty selection sets the assignment
  const penaltyPath = _penaltyPathFromElem(elem);

  if (!callingPositionID) {
    _assignCaller(penaltyPath, null, null)
  } else {
    const positionShortName = _getPositionShortNameFromPositionID(callingPositionID) 
    const callingOfficialID = _getOfficialIDFromOfficialPositionShortName(k.Game, positionShortName)
    _assignCaller(penaltyPath, callingPositionID, callingOfficialID)
  }

  _closeDialogOnPositionSelection(k, callingPositionID, elem, event);
}

function pltClearOtherOfficialPosition(k, v, elem, event) {
  // Handles a click in the Other section
  // When the div has class sbActive, it clears the assignment.
  // Otherwise the click is ignored

  // Ignore clicks on the select controls inside this div
  if (event && $(event.target).closest('select').length) {
    return;
  }

  if (elem.hasClass('sbActive')) {
    _assignCaller(_penaltyPathFromElem(elem), null, null);
    _closeDialogOnPositionSelection(k, v, elem, event);
  }
}

//###################################################################
// Temporary OfficialPosition + Official Assignment
//###################################################################

function pltIsTemporaryOfficialPositionSelectedInitialValue(k, v, elem) {
  // option is selected when:
  //  it's value matches the CallingPosition,
  //  and the CallingOfficial does not match the CallingPosition.CurrentOfficial
  const penaltyPath = _penaltyPathFromElem(elem);
  const thisOptionValue = elem.attr('value')
  const callingPositionID = WS.state[penaltyPath + '.CallingPosition'] || ""
  return (thisOptionValue == callingPositionID) && !_callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath)
}

function pltIsTemporaryOfficialSelectedInitialValue(k, v, elem) {
  // option is selected when:
  //  it's value matches the CallingOfficial, and
  //  it does not match the CallingPosition.CurrentOfficial
  const penaltyPath = _penaltyPathFromElem(elem);
  const thisOptionValue = elem.attr('value')
  const callingOfficialID = WS.state[penaltyPath + '.CallingOfficial'] || ""
  return (thisOptionValue == callingOfficialID) && !_callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath)
}

function pltIsTemporaryAssignmentActive (k, v, elem) {
  // Temporary Assignment section is active when a CallingPosition is assigned, and the CallingOfficial does not match the CurrentOfficial of the CallingPosition
  const penaltyPath = _penaltyPathFromElem(elem);
  const callingPositionID = WS.state[penaltyPath + '.CallingPosition'] || ""
  return callingPositionID ? !_callingOfficialIsAssignedToCallingPosition(k.Game, penaltyPath) : false
}

function pltToggleTemporaryAssignment(k, v, elem, event) {
  // Ignore clicks on the select controls inside this div
  if (event && $(event.target).closest('select').length) {
    return;
  }

  const selects = elem.find('select')

  const selectedCallingPositionID = selects.eq(0).val();
  const selectedCallingOfficialID = selects.eq(1).val();

  const penaltyPath = _penaltyPathFromElem(elem);

  if (elem.hasClass('sbActive')) {
      _assignCaller(penaltyPath, null, null);
  } else {

    // Recording an empty position is not allowed
    if (!selectedCallingPositionID) {
      return;
    }

    _assignCaller(penaltyPath, selectedCallingPositionID, selectedCallingOfficialID);
  }

  _closeDialogOnPositionSelection(k, v, elem, event);
}

//###################################################################
//
//  LT Annotation Editor
//
//###################################################################

function _pltOpenAnnotationEditor(gameId, teamId, skaterId) {
  WS.SetupDialog($('#AnnotationEditor'), _pltGetFieldingPrefix(gameId, teamId, skaterId), {
    modal: true,
    title: 'Annotation & Box Trip Editor',
    width: '700px',
    buttons: {
      Close: function () {
        $(this).dialog('close');
      },
    },
  });
}

function pltSubable(k) {
  return !isTrue(WS.state[k.upTo('Fielding') + '.PenaltyBox']) && !isTrue(WS.state[k.upTo('Fielding') + '.HasUnserved']);
}

function pltNoUnend(k, v) {
  return isTrue(v) || WS.state[k.upTo('Fielding') + '.CurrentBoxTrip'] == null;
}
