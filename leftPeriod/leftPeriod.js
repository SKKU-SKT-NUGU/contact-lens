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

function getLeftdate(ed){
    var now = new Date()
    var gap = ed.getTime()-now.getTime()-9*60*60*1000
    if(gap < 0){
        gap = 0
    }
    gap = Math.ceil(gap/1000/24/60/60)
    return gap
}

class Response {
    constructor(req) {
        this.version = req.version
        this.resultCode = 'OK' //can be modified later
        this.output = {}
    }

    getID(req, res) {
        return new Promise(function (resolve, reject) {
            if(req.context.session.accessToken == undefined){
                res.setParameters({
                    LP_response: '계정이 연동되어 있지 않아요. 누구 앱에서 컨택트 렌즈 관리 Play를 찾아서 계정을 연동해 주세요.'
                })
                //res.resultCode = 'notlogined'
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
                    res.setParameters({
                        LP_response: '액세스 토큰이 refresh되지 않았어요. 누구 앱에서 계정 연동을 다시 해 주세요.'
                    })
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
                        LP_response: '사용자 데이터 접근에 실패했어요. 잠시 후에 다시 시도해 주세요.'
                    })
                    reject(new Error(err))
                }
                else {
                    if (rows[0] != undefined) { // lens exists
                        console.log(`Lens exists. End date: ${rows[0].enddate}`)
                        var ED = new Date(rows[0].enddate)
                        resolve([id, ED])
                    }
                    else { // lens doesn't exist
                    res.setParameters({
                        LP_response: '등록된 렌즈가 없어요. 렌즈를 등록하시려면 등록해 줘 라고 해 주세요.'
                    })
                        reject(new Error('no lens'))
                    }
                }
            })
        })
    }

    writeResponse(req, res, id, ed) {
        return new Promise(function (resolve, reject) {
            var leftdate = getLeftdate(ed)
            if (leftdate == 0) {
                console.log('lens expired')
                res.setParameters({
                    LP_response: `만료일인 ${ed.getFullYear()}년 ${ed.getMonth()+1}월 ${ed.getDate()}일이 지났어요. 렌즈 정보를 삭제할게요`
                })
                connection.query('delete from user where id = ?', [id], function (err, rows, fields) {
                    if (err) {
                        res.setParameters({
                            LP_response: `만료일인 ${ed.getFullYear()}년 ${ed.getMonth()+1}월 ${ed.getDate()}일이 지났어요. 렌즈 정보를 삭제할게요.. 그런데 사용자 데이터 삭제에 실패했어요. 잠시 후에 다시 시도해 주세요.`
                        })
                        reject(new Error(err))
                    }
                    else {
                        console.log('lens deleted')
                        resolve()
                    }
                })
            }
            else {
                console.log('lens not expired')
                res.setParameters({
                    LP_response: `만료일인 ${ed.getFullYear()}년 ${ed.getMonth()+1}월 ${ed.getDate()}일까지 ${leftdate}일 남았어요.`
                })
                resolve()
            }
        })
    }

    setParameters(outputKeyAndValues) { //overwrites an object if already exists. Otherwise, it appends the given object.
        this.output = _.assign(this.output, outputKeyAndValues)
    }

}

function myAction(params) {
    console.log(`HTTP Request ${JSON.stringify(params)}`)
    response = new Response(params)

    /*response.doAction(params)
    console.log(`HTTP Response: ${JSON.stringify(response)}`)*/
    
    return response.getID(params, response)
        .then(function (ID) {
            console.log(`Login Successful. ID: ${ID}`)
            return response.checkDB(params, response, ID)
        })
        .then(function (ID) {
            console.log(`checkDB resolved with date: ${ID[1]}. id: ${ID[0]}`) //id exists
            return response.writeResponse(params, response, ID[0], ID[1])
        })
        .catch(function (err) {
            console.log(err) //error
            //return response
        })
        .then(function () {
            console.log(`HTTP Response: ${JSON.stringify(response)}`)
            return response
        })
}

exports.main = myAction