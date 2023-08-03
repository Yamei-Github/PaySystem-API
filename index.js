const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8082;
require('dotenv').config();
const TronWeb = require('tronweb');

const config = {
  connectionString:
    "postgres://paysystemdb_user:NImIQdhh8I8sWXJb79Z24uQTI5oJQqUD@dpg-cir0bbdiuie930j5d8lg-a.singapore-postgres.render.com/paysystemdb?ssl=true",
};

const { Client } = require('pg');
const client = new Client(config);
client.connect();

var mysql = require('mysql');

var con = mysql.createConnection({
  host: "119.45.167.2",
  user: "admin",
  password: "yamei666888@"
});

app.use(cors({ origin: true, credentials: true }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit:50000 }));

function GenerateJWT(_userId, _username)
{
  return jwt.sign(
      { userId: _userId, username: _username},
      process.env.TOKEN_KEY,
      { expiresIn: "24h" }
    );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.TOKEN_KEY, (err, user) =>
    {
      if (err)
      {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  }
  else
  {
    res.sendStatus(401);
  }
}

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

app.get('/', async (req, res) => {
  res.status(200).send("OK");
})

app.get('/user/get/:id', verifyToken, async (req, res) => {
  client.query("SELECT * FROM users WHERE id = '"+req.params.id)
        .then((result) => {
          res.send(JSON.stringify(result.rows[0].username));
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.post('/user/login', async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(500).send("错误: 请键入您的用户名和密码以登录。");
  }

  client.query("SELECT * FROM users WHERE username = '"+req.body.username+"' AND password = crypt('"+req.body.password+"', password)")
        .then((result) => {
          if(result.rows.length > 0)
          {
            const token = GenerateJWT(result.rows[0].id, result.rows[0].username);

            client.query("UPDATE users SET last_login = NOW() WHERE id = "+result.rows[0].id)

            res.status(200).json({
                success: true,
                data: {
                  userId: result.rows[0].id,
                  token: token,
                },
              });
          }
          else
          {
            res.status(500).send("错误：用户名或密码错误。");
          }
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/request/latest', verifyToken, async (req, res) => {
  
  client.query("SELECT * FROM requests ORDER BY datetime DESC LIMIT 5")
          .then((result) => {

            res.send(JSON.stringify(result.rows));

          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
})

app.get('/request/get/', verifyToken, async (req, res) => {
  
  const page = req.query.page || 1;
  const type = req.query.type;
  const orderId = req.query.orderId;
  const sender = req.query.sender;
  const receiver = req.query.receiver;
  const uid = req.query.uid;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const amount = req.query.amount;
  
  var sql = "SELECT * FROM requests WHERE request_type = "+type;
  if(orderId)
    sql += " AND id = "+orderId;
  if(sender)
    sql += " AND sender_address LIKE '%"+sender+"%'";
  if(receiver)
    sql += " AND receiver_address LIKE '%"+receiver+"%'";
  if(amount)
    sql += " AND uid = "+uid;
  if(amount)
    sql += " AND amount = "+amount;
  if(startTime && endTime)
    sql += " AND datetime BETWEEN '"+startTime+" 00:00:00' AND '"+endTime+" 23:59:59'";
  
  sql += " ORDER BY id ASC";

  client.query(sql)
        .then((result) => {

          const perPage = 30; // Number of items per page
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;

          const data = result.rows.slice(startIndex, endIndex);
          var total = 0;
          
          for(var i = 0; i < result.rows.length; i++)
          {
            total += result.rows[i]['amount'];
          }

          res.header('Access-Control-Allow-Origin', "*");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
          res.header("Access-Control-Allow-credentials", true);
          res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, UPDATE");
          
          res.json({
            currentPage: page,
            perPage: perPage,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / perPage),
            data: data,
            total : total
          });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.get('/changelog/get/', verifyToken, async (req, res) => {
  
  const page = req.query.page || 1;
  const orderId = req.query.orderId;
  const address = req.query.address;
  const uid = req.query.uid;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const amount = req.query.amount;
  
  var sql = "SELECT * FROM requests"
  
  if(orderId || address || uid || amount || startTime || endTime || amount)
    sql += " WHERE";

  if(orderId)
    sql += " id = "+orderId;
  if(address)
    sql += " AND (sender_address LIKE '%"+address+"%' OR receiver_address LIKE '%"+address+"%')";
  if(uid)
    sql += " AND uid = "+uid;
  if(amount)
    sql += " AND amount = "+amount;
  if(startTime && endTime)
    sql += " AND datetime BETWEEN '"+startTime+" 00:00:00' AND '"+endTime+" 23:59:59'";
 
  sql += " ORDER BY id ASC";

  client.query(sql)
        .then((result) => {
           
          const perPage = 30; // Number of items per page
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;
          
          var before = 0;

          var processedData = [];

          for(var i = 0; i < result.rows.length; i++)
          {
            var temp = {};
            temp['id'] = result.rows[i].id;
            temp['uid'] = result.rows[i].uid;
            temp['request_type'] = result.rows[i].request_type;

            temp['before'] = before;
            temp['amount'] = result.rows[i].amount;
            
            if(result.rows[i].request_type == 0)
            {
              temp['address'] = result.rows[i].sender_address;
              temp['after'] = (before + result.rows[i].amount);
            }
            else
            {
              temp['address'] = result.rows[i].receiver_address;
              temp['after'] = (before - result.rows[i].amount);
            }

            before = temp['after'];
            temp['time'] = result.rows[i].datetime;

            processedData.push(temp);
          }

          const data = processedData.slice(startIndex, endIndex);

          res.json({
            currentPage: page,
            perPage: perPage,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / perPage),
            data: data,
          });

        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/actionlog/get/', verifyToken, async (req, res) => {
  
  client.query("SELECT * FROM action_log")
          .then((result) => {
           
            const perPage = 30; // Number of items per page
            const page = parseInt(req.params.page) || 1; // Current page number
            const startIndex = (page - 1) * perPage;
            const endIndex = page * perPage;

            const data = result.rows.slice(startIndex, endIndex);

            res.json({
              currentPage: page,
              perPage: perPage,
              totalItems: result.rows.length,
              totalPages: Math.ceil(result.rows.length / perPage),
              data: data
            });

          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
})

app.get('/setting/get/', verifyToken, async (req, res) => {
  
    client.query("SELECT * FROM settings ORDER BY id")
          .then((result) => {
            res.send(result.rows);
          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
})

app.post('/setting/save/', verifyToken, async (req, res) => {
  
  client.query("UPDATE settings SET setting_value ='"+req.body.contract_address+"' WHERE setting_name = 'contract_address'")
        .then((result) => {
          client.query("UPDATE settings SET setting_value ="+req.body.exchange_rate+" WHERE setting_name = 'exchange_rate'")
                .then((result2) => {
                  res.send("OK"); 
                })
                .catch((e) => {
                  console.error(e.stack);
                  res.status(500).send(e.stack);
                })
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

function GetCurrentTime()
{
    const currentTimeStamp = Date.now();
    const date = new Date(currentTimeStamp);
    const formattedDateTime = date.toISOString().slice(0, 19).replace('T', ' ') + '.' + ('00' + date.getMilliseconds())

    return formattedDateTime;
}

// -------------------------------------------------------------------------------------------------------------------------

const contractAddress = process.env.CONTRACT_ADDRESS;
const apiKey = process.env.TRONGRID_PRIVATE_KEY;

var privateKey = process.env.CONTRACT_OWNER_PRIVATE_KEY;

const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  solidityNode : 'https://api.shasta.trongrid.io',
  eventServer : 'https://api.shasta.trongrid.io',
  //headers: { "TRON-PRO-API-KEY": apiKey },
  privateKey: privateKey,
});
let abi = [process.env.CONTRACT_ABI];

ListenToContract();

app.get('/contract/balance', async (req, res) => {
  try {

    let contract = await tronWeb.contract(abi).at(contractAddress);
    let result = await contract.getBalance().call();
    let data = tronWeb.toDecimal(result._hex) / 1000000;

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).send(error.stack);
  }
});

app.post('/contract/deposit', async (req, res) => {
  try {

    let contract = await tronWeb.contract(abi).at(contractAddress);
    let result = await contract.deposit(req.body.amount * 1000000).send();
    
    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send(error.stack);
  }
});

app.post('/contract/withdraw', async (req, res) => {
  try {

    let contract = await tronWeb.contract(abi).at(contractAddress);
    let result = await contract.withdraw(req.body.recipient, req.body.amount * 1000000).send();
    
    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send(error.stack);
  }
});

async function ListenToContract()
{
  let instance = await tronWeb.contract().at(contractAddress);

  instance["Deposit"]().watch((err, eventResult) => {
    if (err) {
        return console.error('Error with "Deposit" event:', err);
    }
    if (eventResult) { 
        console.log('eventResult:',eventResult);

        client.query("INSERT INTO requests VALUES (0, "+tronWeb.address.fromHex(eventResult.account)+", "+contractAddress+", "+(eventResult.amount / 1000000)+", NOW(), "+eventResult.uid)
        .then((result) => {
          ModifyUserCoin((eventResult.amount / 1000000), eventResult.uid)
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
    }
  });

  instance["Withdrawal"]().watch((err, eventResult) => {
    if (err) {
        return console.error('Error with "Withdrawal" event:', err);
    }
    if (eventResult) { 
        console.log('eventResult:',eventResult);

        client.query("INSERT INTO requests VALUES (1, "+contractAddress+", "+tronWeb.address.fromHex(eventResult.account)+", "+(eventResult.amount / 1000000)+", NOW(), "+eventResult.uid)
        .then((result) => {
          ModifyUserCoin((eventResult.amount / 1000000), eventResult.uid)
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
    }
  });
}

function ModifyUserCoin(amount, userId)
{
  con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");

    var sql = "UPDATE cmf_user SET score ="+amount+" WHERE id = "+userId+";";
    con.query(sql, function (err, result) {
      if (err) throw err;
      console.log("1 record updated");
    });
  });
}