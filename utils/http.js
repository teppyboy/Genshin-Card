const axios = require('axios')

async function http(options) {
    console.log(options)
    try {
        return await axios(options)
    } catch (error) {
        throw new Error(error)
    }
}

module.exports = http
