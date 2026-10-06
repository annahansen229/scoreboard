package com.carolinarollergirls.scoreboard.core.game;

import com.carolinarollergirls.scoreboard.core.interfaces.Game;
import com.carolinarollergirls.scoreboard.core.interfaces.Official;
import com.carolinarollergirls.scoreboard.core.interfaces.OfficialPosition;
import com.carolinarollergirls.scoreboard.core.interfaces.Penalty;
import com.carolinarollergirls.scoreboard.core.interfaces.Team;
import com.carolinarollergirls.scoreboard.event.ScoreBoardEventProviderImpl;
import com.carolinarollergirls.scoreboard.event.Value;

public final class OfficialPositionImpl
    extends ScoreBoardEventProviderImpl<OfficialPosition> implements OfficialPosition {
    public OfficialPositionImpl(Game g, String id) {
        super(g, g.getId() + "_" + id, Game.OFFICIAL_POSITION);
        game = g;
        subId = id;
        addProperties(props);
        setInverseReference(CURRENT_OFFICIAL, Official.CURRENT_POSITION);
        setInverseReference(PENALTIES, Penalty.CALLING_POSITION);
        setCopy(CURRENT_OFFICIAL_NAME, this, CURRENT_OFFICIAL, Official.NAME, true);
        setRecalculated(NAME)
            .addIndirectSource(this, TEAM, Team.UNIFORM_COLOR)
            .addIndirectSource(this, TEAM, Team.DISPLAY_NAME);
        if (id.endsWith(Team.ID_1)) { set(TEAM, game.getTeam(Team.ID_1)); }
        if (id.endsWith(Team.ID_2)) { set(TEAM, game.getTeam(Team.ID_2)); }
        set(NAME, id);
    }

    @Override
    public String getProviderId() {
        return subId;
    }

    @Override
    protected Object computeValue(Value<?> prop, Object value, Object last, Source source, Flag flag) {
        if (prop == NAME) {
            Team team = get(TEAM);
            if (team != null) {
                String uniformColor = team.get(Team.UNIFORM_COLOR);
                String teamName =
                    uniformColor == null || "".equals(uniformColor) ? team.get(Team.DISPLAY_NAME) : uniformColor;
                return subId.substring(0, subId.length() - 1) + " " + teamName;
            } else if ("IPRF".equals(subId)) {
                return "IPR Front";
            } else if ("IPRR".equals(subId)) {
                return "IPR Rear";
            } else if ("OPRF".equals(subId)) {
                return "OPR Front";
            } else if ("OPRM".equals(subId)) {
                return "OPR Middle";
            } else if ("OPRR".equals(subId)) {
                return "OPR Rear";
            } else if ("AR".equals(subId)) {
                return "ALTR";
            } else if ("NSOA".equals(subId)) {
                return "ALTN";
            } else {
                return subId;
            }
        }
        return value;
    }

    @Override
    protected void valueChanged(Value<?> prop, Object value, Object last, Source source, Flag flag) {
        if (prop == CURRENT_OFFICIAL && value != null && last == null) {
            Official o = (Official) value;
            for (Penalty p : getAll(PENALTIES)) {
                if (p.get(Penalty.CALLING_OFFICIAL) == null) { p.set(Penalty.CALLING_OFFICIAL, o); }
            }
        }
    }

    private Game game;
    private String subId;
}
