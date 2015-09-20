import express from 'express';
import bodyParser from 'body-parser';
import Redis from 'then-redis';
import {AuctionMessageTranslator} from './auction-message-translator';
import {AuctionSniper, SniperState, SniperSnapshot} from './auction-sniper';
import Auction from './auction';
import SnipersTableModel from './snipers-table-model';

const debug = require('debug')('goos:Sniper');
let server;

function main() {
    const sniperId = process.argv[2];
    const itemIds = process.argv.slice(3);

    let subscriber = Redis.createClient();
    let publisher = Redis.createClient();

    const snipers = new SnipersTableModel();

    function joinAuction(itemId) {
        snipers.addSniper(SniperSnapshot.joining(itemId));

        const Topic = `auction-${itemId}`;
        const auction = Auction(Topic, publisher, sniperId);
        const translator = AuctionMessageTranslator(sniperId, AuctionSniper(itemId, auction, snipers));
        debug(sniperId, "is joining auction for", itemId);
        auction.join();
        subscriber.subscribe(Topic);
        subscriber.on('message', (topic, jsonMessage) => {
            if (topic == Topic) translator.processMessage(topic, JSON.parse(jsonMessage));
        });
    }

    itemIds.forEach(joinAuction);

    const app = express();
    const urlencodedParser = bodyParser.urlencoded({ extended: false })

    app.get('/', function (req, res) {
        res.send(`<html><body>
            <form method="post">
                <input type="text" name="new-item-id" id="new-item-id"/>
                <button type="submit" id="join-button" value="Join"/>
            </form>
            ${snipers.render()}
        </body></html>`);
    });

    app.post('/', urlencodedParser, function (req, res) {
        const itemId = req.body["new-item-id"];
        joinAuction(itemId);

        res.redirect("/");
    })

    server = app.listen(3000, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('Auction Sniper listening at http://%s:%s', host, port);
    });
}

export default {
    main,
}

