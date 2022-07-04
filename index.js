const puppeteer = require('puppeteer');
const notifier = require('node-notifier');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const config = {
  headless: true, // Запуск в режиме браузера false
  selectors: {
    table: '.sch-table__row-wrap',
  },
};

let ticketsFound = false;
let message = '';
let trainFound = false;

function formatDate(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}


function notifyTicketFound (message, trainNumber) {
  notifier.notify({
    title: `Билеты найдены на поезд ${trainNumber}`,
    message,
    sound: true,
  });
  console.log(message);
};

const startTicketsParser = async (trainConfig) => {
  const browser = await puppeteer.launch({ headless: config.headless });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2 });

  await page.goto(
    `https://pass.rw.by/ru/route/?from=${trainConfig.from}&to=${trainConfig.to}&date=${formatDate(
      trainConfig.date,
    )}`,
  );

  // const trainCount = await page.$$eval(config.selectors.table + ' > tbody > tr', table => table.length);
  // console.log('Найдено поездов: ', trainCount || 0);

  const checkTrain = async () => {
    const train = await page.$$eval(
      config.selectors.table,
      (trainRow, trainNumber) =>
        trainRow.reduce((result, item) => {
          if (item.querySelector('.train-number').innerText.indexOf(trainNumber) !== -1) {
            result.name = item.querySelector('.train-route').innerText;
            places = [];
            let prevType = null
            item.querySelectorAll('.sch-table__t-item').forEach((el) => {
              let type = el.querySelector('.sch-table__t-name').innerText
              if (!type && prevType) {
                type = prevType
              }
              prevType = type
              places.push({
                type: type,
                tickets: el.querySelector('.sch-table__t-quant > span').innerText,
                cost: el.querySelector('.ticket-cost').innerText,
              });
            });
            result.places = places;
          }
          return result;
        }, {}),
      trainConfig.trainNumber,
    );

    if (train.name) {
      const places = train.places.map((item) => {
        return {
          type: item.type,
          tickets: parseInt(item.tickets) | 0,
          cost: parseFloat(item.cost.replace(',', '.')),
        };
      });
      ticketsFound = places.some((item) => item.tickets >= trainConfig.ticketCount);
      trainFound = true;
      message = places.reduce((message, item) => message + `${item.type}: ${item.tickets} `, '');
    } else {
      console.log(`Поезд не найден ${trainConfig.trainNumber}`);
      await browser.close();
    }
  };

  await checkTrain();

  if (!ticketsFound && trainFound) {
    let delay = setInterval(async () => {
      await checkTrain();
      await page.reload();
      if (ticketsFound) {
        clearInterval(delay);
        notifyTicketFound(message, trainConfig.trainNumber);
        await browser.close();
      }
    }, 60000);
  } else {
    notifyTicketFound(message, trainConfig.trainNumber);
    await browser.close();
  }
};

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 -f [from] -t [to] -d [date] -n [trainNumber] -c [count]')
  .example('$0 -f Минск -t Брест -d 2020-05-08 -n 704Б -c 1')
  .option('f', {
    alias: 'from',
    describe: 'Наименование станции отправления, пример: МИНСК-ПАССАЖИРСКИЙ',
    type: 'string',
  })
  .option('t', {
    alias: 'to',
    describe: 'Наименование станции прибытия, пример: БРЕСТ-ЦЕНТРАЛЬНЫЙ',
    type: 'string',
  })
  .option('d', {
    alias: 'date',
    describe: 'Дата поездки (год-месяц-день), пример: 2018-05-20, сегодня, завтра',
    type: 'string',
    coerce: (arg) => {
      if (arg === undefined){
        return arg
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (arg === 'сегодня') {
        return today;
      }
      if (arg === 'завтра') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      const date = new Date(arg);
      if (isNaN(date) || date < today) {
        throw Error(`Неверная дата: ${arg}`);
      }
      return date;
    },
  })
  .option('n', {
    alias: 'number',
    describe: 'Номер поезда, пример: 607Б',
    type: 'string',
  })
  .option('c', {
    alias: 'count',
    describe: 'Количество билетов',
    type: 'number',
    coerce: (count) => {
      if (count === undefined) {
        return 1;
      }
      if (isNaN(count) || count < 1) {
        throw Error('неверное количесто мест');
      }
      return count;
    },
  })
  .demandOption(
    ['f', 't', 'd', 'n', 'c'],
    'Введите номер поезда, станцию отправления, станцию назначения и дату',
  ).argv;

startTicketsParser({
  from: argv.from,
  to: argv.to,
  date: argv.date,
  trainNumber: argv.number,
  ticketCount: argv.count,
});
