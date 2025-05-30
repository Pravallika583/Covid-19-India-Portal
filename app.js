const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jsonwebtoken = require('jsonwebtoken')

const app = express()
app.use(express.json())

let db = null

const initializedBAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, 'covid19IndiaPortal.db'),
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started at 3000 port')
    })
  } catch (e) {
    console.log(e.message)
  }
}
initializedBAndServer()

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const query = `Select * from user where username = '${username}';`
  const result = await db.get(query)
  if (result === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let isPasswordMatch = await bcrypt.compare(password, result.password)
    if (!isPasswordMatch) {
      response.status(400)
      response.send('Invalid password')
    } else {
      payload = {username: request.username}
      let jwtToken = jsonwebtoken.sign(payload, 'Secret')
      console.log(jwtToken)
      response.send({jwtToken})
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jsonwebtoken.verify(jwtToken, 'Secret', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  const query = `Select * from state`
  const result = await db.all(query)
  response.send(
    result.map(eachItem => ({
      stateId: eachItem.state_id,
      stateName: eachItem.state_name,
      population: eachItem.population,
    })),
  )
})

app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const query = `Select * from state where state_id = ${stateId}`
  const result = await db.get(query)
  response.send({
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  })
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const query = `Insert into district(district_name,state_id,cases,cured,active,deaths)
  values( '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`
  await db.run(query)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId', async (request, response) => {
  let {districtId} = request.params
  let query = `Select * from district where district_id = ${districtId};`
  let allQueries = await db.get(query)
  console.log(allQueries)
  response.send({
    districtId: districtId,
    districtName: allQueries.district_name,
    stateId: allQueries.state_id,
    cases: allQueries.cases,
    cured: allQueries.cured,
    active: allQueries.active,
    deaths: allQueries.deaths,
  })
})

app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `delete from district where district_id = ${districtId}`
    await db.get(query)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const query = `Update district set district_name = '${districtName}',state_id = ${stateId},
  cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths} where district_id = ${districtId};`
    await db.run(query)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `Select sum(cases), sum(cured), sum(active), sum(deaths) from district where state_id = ${stateId}`
    const result = await db.get(query)
    response.send({
      totalCases: result['sum(cases)'],
      totalCured: result['sum(cured)'],
      totalActive: result['sum(active)'],
      totalDeaths: result['sum(deaths)'],
    })
  },
)

module.exports = app
