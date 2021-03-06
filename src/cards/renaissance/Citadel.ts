import Project from "../Project";
import type Player from "../../server/Player";
import type Card from "../Card";

export default class Citadel extends Project {
    cardArt = "/img/card-img/CitadelArt.jpg";
    cardText = "The first time you play an Action card during each of your turns, play it again afterwards.";
    intrinsicCost = {
        coin: 8
    };
    name = "citadel";
    async onPlayerJoinProject(player: Player): Promise<any> {
        let usedThisTurn = false;
        let cardToReplay: Card | null = null;
        player.events.on('turnStart', async () => {
            usedThisTurn = false;
            cardToReplay = null;
            return true;
        });
        player.events.on('willPlayCard', async (card) => {
            if (card.types.includes("action") && !usedThisTurn) {
                cardToReplay = card;
                usedThisTurn = true;
            }
            return true;
        });
        player.effects.setupEffect('cardPlayed', 'citadel', {
            compatibility: {},
            relevant: (ctx, tracker) => tracker.viewCard() === cardToReplay
        }, async (remove, tracker) => {
            if (tracker.viewCard() === cardToReplay) {
                player.lm('The citadel activates for %p.');
                cardToReplay = null;
                await player.replayActionCard(tracker.viewCard(), tracker, true);
            }
        });
    }
}