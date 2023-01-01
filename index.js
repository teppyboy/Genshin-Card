const express = require('express')
const compression = require('compression')
const pino = require('pino')
const cache = require('./utils/cache')
const userInfo = require('./userInfo')
const svg = require('./utils/svg')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const app = express()
app.use(express.static('public'))
app.use(compression())
app.set('view engine', 'pug')

app.get('/', (req, res) => {
    res.render('index')
})

const CACHE_0 = 'max-age=0, no-cache, no-store, must-revalidate'
const CACHE_10800 = 'max-age=10800'

async function _getPlayerCard(req, res, detail) {
    const { skin, uid } = req.params
    logger.info(
        'Request received: UID: %s, Skin: %s, Detailed: %s',
        uid,
        skin,
        detail
    )
    try {
        var data = await userInfo({ uid, detail })
    } catch (err) {
        res.json({
            msg: err,
            code: -1,
        })
        return
    }
    const svgImage = await svg({ data, skin, detail })
    res.set({
        'content-type': 'image/svg+xml',
        'cache-control': isNaN(skin) ? CACHE_0 : CACHE_10800,
    })
    res.send(svgImage)
}

async function getPlayerCard(req, res) {
    await _getPlayerCard(req, res, false)
}

async function getPlayerCardDetailed(req, res) {
    await _getPlayerCard(req, res, true)
}

// app.get('/:skin/:uid.png', getPlayerCard)
app.get('/:skin/:uid.svg', getPlayerCard)

// app.get('/detail/:skin/:uid.png', getPlayerCardDetailed)
app.get('/detail/:skin/:uid.svg', getPlayerCardDetailed)

app.get('/heart-beat', (_, res) => {
    res.set({
        'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
    })

    res.json({
        msg: 'alive',
        code: 0,
    })

    logger.info('heart-beat')
})

const listener = app.listen(3000, () => {
    logger.info('Your app is listening on port ' + listener.address().port)
})
