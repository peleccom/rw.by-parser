const notifier = require('node-notifier');
const yargs = require('yargs/yargs');
const axios = require('axios').default;
const fs = require('fs');
const cheerio = require('cheerio');
const { hideBin } = require('yargs/helpers');

const config = {
  selectors: {
    trainRow: '.sch-table__row-wrap',
    trainRowNumber: '.train-number',
    trainRowRoute: '.train-route',

    trainRowPlace: '.sch-table__t-item',
    trainRowPlaceCost: '.ticket-cost',
    trainRowPlaceCount: '.sch-table__t-quant > span',
    trainRowPlaceName: '.sch-table__t-name',
  },
};

const debug = false

function formatDate(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function notifyTicketFound(message, trainNumber) {
  notifier.notify({
    title: `Билеты найдены на поезд ${trainNumber}`,
    message,
    sound: true,
  });
  console.log(message);
  return message;
}


async function getTrain (trainConfig, content) {
  const $ = cheerio.load(content);
  for (let item of $(config.selectors.trainRow)) {
    const $trainRowItem = $(item);
    const trainNumber = $trainRowItem.find(config.selectors.trainRowNumber).text().trim();
    if (trainNumber === trainConfig.trainNumber) {
      const places = [];
      const trainRoute = $trainRowItem.find(config.selectors.trainRowRoute).text().trim();
      let prevType = null;
      for (let place of $trainRowItem.find(config.selectors.trainRowPlace)) {
        const $placeItem = $(place);
        let type = $placeItem.find(config.selectors.trainRowPlaceName).text().trim();

        let tickets = $placeItem.find(config.selectors.trainRowPlaceCount).text().trim();
        tickets = parseInt(tickets) | 0;

        let cost = $placeItem.find(config.selectors.trainRowPlaceCost).text().trim();
        cost = parseFloat(cost.replace(',', '.')).toString();

        if (!type && prevType) {
          type = prevType;
        }
        prevType = type;

        places.push({
          type,
          tickets,
          cost,
        });
      }

      return {
        name: trainRoute,
        places,
      }
    }
  }

  return null;
}


async function loadPageContent (url) {
  url = encodeURI(url);
  return await axios.get(url).then((response) => response.data)
}

function filterPlaces(places, trainConfig) {
  if (trainConfig.priceExclude) {
    // filter out by price
    places = places.filter((item) => item.cost != trainConfig.priceExclude)
  }

  if (trainConfig.typeExclude) {
    // filter out by place type
    places = places.filter((item) => item.type != trainConfig.typeExclude)
  }


  // filter number of places
  places = places.filter((item) => item.tickets >= trainConfig.ticketCount);


  return places
}

async function startTicketsParser (trainConfig) {
  const formattedDate = formatDate(
    trainConfig.date,
  )
  console.log(`Поиск билетов ${trainConfig.from}->${trainConfig.to} (${trainConfig.trainNumber}) ${formattedDate}`)
  let ticketsFound = false;
  let message = '';

  const url = `https://pass.rw.by/ru/route/?from=${trainConfig.from}&to=${trainConfig.to}&date=${formattedDate}`
  let firstScanIteration = true;

  while (true) {
    const content = await loadPageContent(url)

    if (debug) {
      fs.writeFile('page.html', content, (err) => {
        if (err) return console.log(err);
      });
    }

    const train = await getTrain(trainConfig, content);

    if (!train) {
      console.log(`Поезд не найден ${trainConfig.trainNumber}`);
      return
    }

    const filteredPlaces = filterPlaces(train.places, trainConfig)
    ticketsFound = !!filteredPlaces.length
    message = filteredPlaces.reduce((message, item) => `${message}${item.type} (${item.cost} руб.): ${item.tickets}\n`, '');


    if (ticketsFound) {
      return notifyTicketFound(message, trainConfig.trainNumber);
    }
    if (firstScanIteration) {
      console.log('Билеты не найдены. Будет произведено переодическое сканирование. Пожалуйста ждите...');
      firstScanIteration = false;
    } else {
      console.log('Билеты не появились')
    }
    await waitInterval(60000)
  }
};

function waitInterval (interval) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, interval)
  })
}

function main() {
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
        if (arg === undefined) {
          return arg;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (arg === 'сегодня' || arg === "today") {
          return today;
        }
        if (arg === 'завтра' || arg === 'tomorrow') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        }
        const date = new Date(arg);
        if (isNaN(date) || date < today) {
          throw Error(`Неверная дата: ${arg}`);
        }
        if (date.getFullYear() !== today.getFullYear() && date.getFullYear() !== today.getFullYear() + 1) {
          throw Error(`Неверный год ${date.getFullYear()}`)
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
    .option('priceExclude', {
      alias: 'x',
      describe: 'Исключить билеты с ценой',
      type: 'string',
    })
    .option('typeExclude', {
      alias: 'z',
      describe: 'Исключить билеты с типом',
      type: 'string',
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
    priceExclude: argv.priceExclude,
    typeExclude: argv.typeExclude,
  });
}



if (require.main === module) {
  main();
}

module.exports = {
  startTicketsParser,
  getTrain,
  loadPageContent,
}

