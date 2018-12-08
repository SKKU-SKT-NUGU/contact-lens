//
// This is a skeleton code to handle an action of NUGU SDK.
// Written by Seungho Han, 
// a student of SKKU, SW department.
// Contact: kevhahn97@skku.edu
//

const _ = require('lodash')
var mysql = require('mysql')
var request = require('request')

var connection = mysql.createConnection({
    host: '106.10.33.167',
    post: 3306,
    user: 'root',
    password: 'dn102997!',
    database: 'lens'
})

class Response {
    constructor(req) {
        this.version = req.version
        this.resultCode = 'OK' //can be modified later
        this.output = {}
    }

    getID(req, res) {
        return new Promise(function (resolve, reject) {
            if(req.context.session.accessToken == undefined){
                res.resultCode = 'notlogined'
                reject(new Error('not logined'))
            }
            var at = req.context.session.accessToken

            var options = {
                uri: 'https://www.googleapis.com/plus/v1/people/me',
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + at
                }
            }

            request(options, function (error, response, body) {
                if (error || (JSON.parse(body).id == undefined)) {
                    res.resultCode = 'loginfail'
                    reject(new Error('loginfail'))
                }
                else {
                    resolve(JSON.parse(body).id)
                }
            })
        })
    }
    checkDB(req, res, id) {
        return new Promise(function (resolve, reject) {
            connection.query('select * from user where id = ?', [id], function (err, rows, fields) {
                if (err) {
                    res.setParameters({
                        del_response: '사용자 데이터 접근에 실패했어요. 잠시 후에 다시 시도해 주세요.'
                    })
                    reject(new Error(err))
                }
                else {
                    if (rows[0] != undefined) { // lens exists
                        console.log(`Lens exists. End date: ${rows[0].enddate}`)
                        resolve(id)
                    }
                    else { // lens doesn't exist
                    res.setParameters({
                        del_response: '등록된 렌즈가 없어요. 렌즈를 등록하시려면 등록해 줘 라고 해 주세요.'
                    })
                        reject(new Error('no lens'))
                    }
                }
            })
        })
    }

    writeResponse(req, res, id) {
        return new Promise(function (resolve, reject) {
            connection.query('delete from user where id = ?', [id], function (err, rows, fields) {
                if (err) {
                    res.setParameters({
                        del_response : '렌즈 삭제에 실패했어요. 다시 시도해 주세요.'
                    })
                    reject(new Error(err))
                }
                else {
                    console.log('lens deleted')
                    res.setParameters({
                        del_response: '등록되어 있던 렌즈를 삭제했어요. 새 렌즈를 등록하시려면 등록해 줘 라고 해 보세요.'
                    })
                    resolve()
                }
            })
        })
    }    

    setParameters(outputKeyAndValues) { //overwrites an object if already exists. Otherwise, it appends the given object.
        this.output = _.assign(this.output, outputKeyAndValues)
    }

}

function myAction(params) {
    console.log(`HTTP Request ${JSON.stringify(params)}`)
    response = new Response(params)
    
    return response.getID(params, response)
        .then(function (ID) {
            console.log(`Login Successful. ID: ${ID}`)
            return response.checkDB(params, response, ID)
        })
        .then(function (ID) {
            console.log(`checkDB resolved with ID: ${ID}`) //id exists
            return response.writeResponse(params, response, ID)
        })
        .catch(function (err) {
            console.log(err)
        })
        .then(function () {
            console.log(`HTTP Response: ${JSON.stringify(response)}`)
            return response
        })
}

exports.main = myAction