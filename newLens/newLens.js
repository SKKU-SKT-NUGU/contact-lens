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

function getStartDate(start) {
    var now = new Date();
    now.setTime(now.getTime()+9*60*60*1000)
    var startDate = new Date();
    startDate.setTime(startDate.getTime()+9*60*60*1000)
    if (start.indexOf('요일') != -1) { //certain day expression
        var day = start.slice(start.indexOf('요일') - 1, start.indexOf('요일'))
        var day_num
        var day_today = now.getDay()
        var day_dist

        if (day_today == 0) { // Sunday to 7 for easy week change (week starts on MON)
            day_today = 7
        }
        switch (day) {
            case '일':
                day_num = 7
                break
            case '월':
                day_num = 1
                break
            case '화':
                day_num = 2
                break
            case '수':
                day_num = 3
                break
            case '목':
                day_num = 4
                break
            case '금':
                day_num = 5
                break
            case '토':
                day_num = 6
                break
        }
        if (start.indexOf('지난') != -1 || day_today < day_num) { //last week
            day_num -= 7
        }
        day_dist = day_today - day_num
        startDate.setDate(startDate.getDate() - day_dist)
    }
    else if (start.indexOf('월') != -1 && start.indexOf('일') != -1) { //certain month, date expression
        var month = parseInt(start.slice(0, start.indexOf('월')))
        let date = parseInt(start.slice(start.indexOf('월') + 1, start.indexOf('일')))
        startDate.setMonth(month - 1)
        startDate.setDate(date)
        if (now.getTime() + 10 < startDate.getTime()) { //if start date is last year
            startDate.setFullYear(startDate.getFullYear() - 1)
        }
    }
    else if (start.indexOf('일') != -1) { //date without month
        let date = parseInt(start.slice(0, start.indexOf('일')))
        startDate.setDate(date)
        if (now.getTime() + 10 < startDate.getTime()) { //if start date is last month
            startDate.setMonth(startDate.getMonth() - 1)
        }
    }
    else { //relative expressions
        var date_dist
        switch (start) {
            case '오늘':
                date_dist = 0;
                break;
            case '어제':
                date_dist = 1;
                break;
            case '그제':
                date_dist = 2;
                break;
        }
        if (start.indexOf('일 전') != -1) { //ceratin past date
            date_dist = parseInt(start.slice(0, start.indexOf('일 전')))
        }
        startDate.setDate(startDate.getDate() - date_dist)
    }
    console.log(startDate)
    return startDate
}

function getEndDate(start, duration) {
    let startDate = getStartDate(start)
    var duration_int
    //need to save StartDate to DB
    if (duration.indexOf('주') != -1) { //week expression
        duration_int = parseInt(duration.slice(0, duration.indexOf('주'))) * 7
    }
    else if (duration.indexOf('개월') != -1) { //month expression
        duration_int = parseInt(duration.slice(0, duration.indexOf('개월'))) * 30
    }
    startDate.setDate(startDate.getDate() + duration_int)
    console.log(startDate)
    return startDate
}

class Response {
    constructor(req) {
        this.version = req.version
        this.resultCode = 'OK' //can be modified later
        this.output = {}

        this.setParameters({
            error: 'no' //can be modified later
        })

        this.setParameters({
            alreadylens: 'no' //can be modified later
        })

        //set Utterance Parameters to response
        this.setParameters({
            duration: req.action.parameters.duration.value,
            startdate: req.action.parameters.startdate.value
        })
        if (req.action.parameters.month != undefined) {
            this.setParameters({
                month: req.action.parameters.month.value
            })
        }
        else if (req.action.parameters.lastweek != undefined) {
            this.setParameters({
                lastweek: req.action.parameters.lastweek.value
            })
        }
    }

    getID(req, res) {
        return new Promise(function (resolve, reject) {
            if(req.context.session.accessToken == undefined){
                res.setParameters({
                    error: 'yes'
                })
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
                    res.setParameters({
                        error: 'yes'
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
        //var DB_id
        //var DB_enddate
        return new Promise(function (resolve, reject) {
            connection.query('select * from user where id = ?', [id], function (err, rows, fields) {
                if (err) {
                    res.setParameters({
                        error: 'yes'
                    })
                    reject(new Error(err))
                }
                else {
                    if (rows[0] != undefined) { // lens exists
                        console.log(`Lens exists. End date: ${rows[0].enddate}`)
                        res.setParameters({
                            alreadylens: 'yes'
                        })
                        reject(new Error('alreadylens'))
                    }
                    else { // lens doesn't exist
                        res.setParameters({
                            alreadylens: 'no'
                        })
                        resolve(id)
                    }
                }
            })
        })
    }

    writeResponse(req, res, id) {
        return new Promise(function (resolve, reject) {
            if (id == '0') {
                console.log('writeResponse not executing')
                resolve()
            }
            else {
                var start_date = req.action.parameters.startdate.value
                var duration = req.action.parameters.duration.value

                if (req.action.parameters.month != undefined) {
                    start_date = `${req.action.parameters.month.value}월${start_date}`
                }
                else if (req.action.parameters.lastweek != undefined) {
                    start_date = `지난${start_date}`
                }

                // with start date and duration, calculate end date
                var lens_end_date = getEndDate(start_date, duration)
                console.log(lens_end_date)
                var endDate = lens_end_date.getFullYear().toString() + '년 ' + (lens_end_date.getMonth() + 1).toString() + '월 ' + lens_end_date.getDate().toString() + '일'
                console.log(endDate)
                //error check
                if (isNaN(lens_end_date.getFullYear()) || isNaN(lens_end_date.getMonth()) || isNaN(lens_end_date.getDate())) {
                    res.setParameters({
                        error: 'yes'
                    })
                    resolve()
                }
                else { //no error
                    connection.query('insert into user values (?, ?)', [id, lens_end_date], function (err, rows, fields) {
                        if (err) {
                            res.setParameters({
                                error: 'yes'
                            })
                            reject(new Error(err))
                        }
                        else {
                            console.log('New lens added')
                            res.setParameters({
                                enddate: endDate
                            })
                            resolve()
                        }
                    })
                }
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
            console.log(err) //error
            //return response
        })
        .then(function () {
            console.log(`HTTP Response: ${JSON.stringify(response)}`)
            return response
        })
}

exports.main = myAction