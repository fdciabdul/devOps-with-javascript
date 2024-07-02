module.exports = {
    // server config
    servers : {
        '123.123.123.123': {
          login: 'root',
          password: 'password',
          name: 'SERVER1'
        },
        '123.123.123.123': {
            login: 'root',
            password: 'password',
            name: 'SERVER2'
          },
      },
      /// token telegram bot and group chat id
      telegramToken: '72691XXXXXXXXXXXXXXXXXX',
      telegramChatId: '-XXXXXXX',

      /// url that will be monitored
      urls : [
        'http://XXXXXXXXXXXXXXXXXXX',
        'http://XXXXXXXXXXXXXXXXXXX'
      ]
}