const calledBySettingPath = 'ScoreBoard.Settings.Setting(ScoreBoard.Penalties.TrackCalledBy)';
const calledByPositionsPath = 'ScoreBoard.Settings.Setting(ScoreBoard.Penalties.TrackCalledBy.Positions)';

function saveCalledByPositions() {
  const positions = [];
  $('#CalledByTrackingDialog .PositionOption:checked').each(function () {
    positions.push(...$(this).attr('data-position').split(','));
  });
  WS.Set(calledByPositionsPath, positions.join(','));

  const gameId = _windowFunctions.getParam('game') || WS.state['ScoreBoard.CurrentGame.Game'];
  if (!gameId) {
    return;
  }
  positions.forEach(function (position) {
    const positionPath = 'ScoreBoard.Game(' + gameId + ').OfficialPosition(' + position + ')';
    if (WS.state[positionPath + '.Id'] == null) {
      WS.Set(positionPath + '.Name', position);
    }
  });
}

function loadCalledByPositions() {
  const storedPositions = WS.state[calledByPositionsPath];
  if (storedPositions == null) {
    return;
  }

  const positions = new Set(storedPositions.split(',').filter(Boolean));
  $('#CalledByTrackingDialog .PositionOption').each(function () {
    const positionCodes = $(this).attr('data-position').split(',');
    $(this).prop('checked', positionCodes.every(function (position) {
      return positions.has(position);
    }));
  });
}

$(function () {
  $('#CalledByTrackingDialog')
    .parent()
    .dialog({
      title: 'Called By Tracking Positions',
      autoOpen: false,
      width: 700,
      modal: true,
      buttons: {
        Close: function () {
          $(this).dialog('close');
        },
      },
      open: loadCalledByPositions,
      close: saveCalledByPositions,
    });
});

WS.AfterLoad(function () {
  var trackCalledBy = isTrue(WS.state[calledBySettingPath]);
  WS.Register(calledBySettingPath, function (k, v) {
    const wasEnabled = trackCalledBy;
    trackCalledBy = isTrue(v);
    if (!wasEnabled && trackCalledBy) {
      $('#CalledByTrackingDialog').parent().dialog('open');
    }
  });
});