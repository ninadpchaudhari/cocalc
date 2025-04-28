#########################################################################
# This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
# License: MS-RSL – see LICENSE.md for details
#########################################################################

###
API for handling the messages described packages/util/message.js

MS-RSL, (c) 2017, SageMath, Inc.
###

async = require('async')

{getAccountWithApiKey} = require("@cocalc/server/api/manage");

Cache = require('lru-cache')
auth_cache = new Cache(max:100, ttl:60000)

misc = require('@cocalc/util/misc')
{defaults, required} = misc

messages = require('@cocalc/util/message')

{ HELP_EMAIL } = require("@cocalc/util/theme")

{Client} = require('../client')

log = (name, logger) ->
    return (m) -> logger.debug("API.#{name}: #{m}")

exports.http_message_api_v1 = (opts) ->
    try
        opts = defaults opts,
            event          : required
            body           : required
            api_key        : required
            database       : required
            projectControl : required
            ip_address     : required
            logger         : required
            cb             : required
    catch err
        opts.cb(err)
        return
    dbg = log('http_message_api_v1', opts.logger)
    dbg("event=#{JSON.stringify(opts.event)}, body=#{JSON.stringify(opts.body)}")

    f = messages[opts.event]
    if not f?
        opts.cb("unknown endpoint '#{opts.event}'")
        return

    if not messages.api_messages[opts.event]
        opts.cb("endpoint '#{opts.event}' is not part of the HTTP API")
        return

    try
        mesg = f(opts.body, true)
    catch err
        opts.cb("invalid parameters '#{err}'")
        return

    if mesg.event == 'query' and mesg.multi_response
        otps.cb("multi_response queries aren't supported")
        return

    # client often expects id to be defined.
    mesg.id ?= misc.uuid()

    client = resp = undefined
    async.series([
        (cb) ->
            get_client
                api_key        : opts.api_key
                logger         : opts.logger
                database       : opts.database
                projectControl : opts.projectControl
                ip_address     : opts.ip_address
                cb      : (err, c) ->
                    client = c; cb(err)
        (cb) ->
            handle_message
                client : client
                mesg   : mesg
                logger : opts.logger
                cb     : (err, r) ->
                    resp = r; cb(err)
    ], (err) ->
        if err
            dbg("#{err} - #{JSON.stringify(resp)}")
        opts.cb(err, resp)
    )

get_client = (opts) ->
    opts = defaults opts,
        api_key        : required
        logger         : required
        database       : required
        projectControl : required
        ip_address     : required
        cb             : required
    dbg = log('get_client', opts.logger)
    dbg()

    account_id = auth_cache.get(opts.api_key)

    async.series([
        (cb) ->
            if account_id
                cb()
            else
                try
                    x = await getAccountWithApiKey(opts.api_key)
                    account_id = x.account_id ? x.project_id
                    if not account_id?
                        cb("No account found. Is your API key wrong?")
                        return
                    # briefly cache api key. see "expire" time in ms above.
                    auth_cache.set(opts.api_key, account_id)
                    cb()
                catch err
                    cb(err)
                    return
        (cb) ->
            # check if user is banned:
            opts.database.is_banned_user
                account_id : account_id
                cb         : (err, is_banned) ->
                    if err
                        cb(err)
                        return
                    if is_banned
                        cb("User is BANNED.  If this is a mistake, please contact #{HELP_EMAIL}")
                        return
                    cb()

    ], (err) ->
        if err
            opts.cb(err)
            return
        options =
            logger         : opts.logger
            database       : opts.database
            projectControl : opts.projectControl
        client = new Client(options)
        client.push_to_client = (mesg, cb) =>
            client.emit('push_to_client', mesg)
            cb?()
        client.ip_address = opts.ip_address
        client.account_id = account_id
        opts.cb(undefined, client)
    )

handle_message = (opts) ->
    opts = defaults opts,
        mesg   : required
        client : required
        logger : undefined
        cb     : required
    dbg = log('handle_message', opts.logger)
    dbg("#{JSON.stringify(opts.mesg)}, #{opts.client.id}")
    name = "mesg_#{opts.mesg.event}"
    f = opts.client[name]
    if not f?
        opts.cb("unknown message event type '#{opts.mesg.event}'")
        return
    opts.client.once 'push_to_client', (mesg) ->
        opts.cb(undefined, mesg)
    f(opts.mesg)



