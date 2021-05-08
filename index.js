const puppeteer = require('puppeteer');
const notifier = require('node-notifier');
const trainConfig = require('./train_config');

const config = {
  trainConfig,
  headless: true, // Запуск в режиме браузера false
  selectors: {
    table: '.sch-table__row-wrap'
  }
};

let ticketsFound = false;
let message = '';
let trainFound = false;

var startParser = async () => {
  const browser = await puppeteer.launch({ headless: config.headless });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2 });
  await page.goto(`https://pass.rw.by/ru/route/?from=${config.trainConfig.from}&to=${config.trainConfig.to}&date=${config.trainConfig.date}`);

  // const trainCount = await page.$$eval(config.selectors.table + ' > tbody > tr', table => table.length);
  // console.log('Найдено поездов: ', trainCount || 0);

  const checkTrain = async () => {
    const train = await page.$$eval(config.selectors.table,
      (trainRow, trainNumber) => trainRow.reduce((result, item) => {
        if (item.querySelector('.train-number').innerText.indexOf(trainNumber) !== -1) {
          result.name = item.querySelector('.train-route').innerText;
          places = []
          item.querySelectorAll('.sch-table__t-item').forEach((el) => {
            places.push({
              type: item.querySelector('.sch-table__t-name').innerText,
              tickets: item.querySelector('.sch-table__t-quant > span').innerText,
            })
          })
          result.places = places
        }
        return result;
      }, {}), config.trainConfig.trainNumber);

    if (train.name) {
      const places = train.places.map((item) => {
        const tickets = parseInt(item.tickets) | 0
        const type = item.type
        return {
          type,
          tickets,
        }
      });
      ticketsFound = places.some(item => item.tickets >= config.trainConfig.ticketCount);
      trainFound = true;
      message = places.reduce((message, item) => message + `${item.type}: ${item.tickets} `, '');
      console.log('check train');
    } else {
      console.log('Поезд не найден ' + config.trainConfig.trainNumber);
      await browser.close();
    }
  };

  await checkTrain();

  const ticketFound = () => {
    notifier.notify({
      title: 'Билеты найдены на поезд ' + config.trainConfig.trainNumber,
      message,
      sound: true,
    });
    console.log(message);
  };

  if (!ticketsFound && trainFound) {
    let delay = setInterval(async () => {
      await checkTrain();
      await page.reload();
      if (ticketsFound) {
        clearInterval(delay);
        ticketFound();
        await browser.close();
      }
    }, 60000);
  } else {
    ticketFound();
    await browser.close();
  }

};

if (config.trainConfig.from.length && config.trainConfig.to.length && config.trainConfig.date && config.trainConfig.trainNumber.length) {
  startParser();
} else {
  console.log('Введите номер поезда, станцию отправления, станцию назначения и дату.')
}

