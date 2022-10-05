const { load } = require('cheerio');
const fs = require('fs');
const app = require('../index');
const axios = require('axios').default;
jest.mock("axios");
jest.mock("node-notifier");


jest.setTimeout(60000)
const TEST_FILE = `${__dirname}/test.html`;
const TEST_FILE_NO_PLACES = `${__dirname}/test_no_places.html`;

function load_test_file(filename=TEST_FILE) {
    return fs.readFileSync(filename);
}

test('test tickets found', async () => {
    const content = load_test_file()
    axios.get.mockResolvedValue({data: content})
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let res = await app.startTicketsParser({
        from: "Гродно",
        to: "Витебск",
        date: new Date(2022, 4, 27),
        trainNumber: '680Б',
        ticketCount: 1,
    })
    res = res.trim()
    expect(res).toBe('Плацкартный (13.18 руб.): 42\nКупейный (18.26 руб.): 5')
});

test('test tickets exclude price', async () => {
    const content = load_test_file()
    axios.get.mockResolvedValue({data: content})
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let res = await app.startTicketsParser({
        from: "Гродно",
        to: "Витебск",
        date: new Date(2022, 4, 27),
        trainNumber: '680Б',
        ticketCount: 1,
        priceExclude: '13.18'
    })
    res = res.trim()
    expect(res).toBe('Купейный (18.26 руб.): 5')
});

test('test tickets exclude type', async () => {
    const content = load_test_file()
    axios.get.mockResolvedValue({data: content})
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let res = await app.startTicketsParser({
        from: "Гродно",
        to: "Витебск",
        date: new Date(2022, 4, 27),
        trainNumber: '680Б',
        ticketCount: 1,
        typeExclude: 'Купейный'
    })
    res = res.trim()
    expect(res).toBe('Плацкартный (13.18 руб.): 42')
});


test('check get train', async () => {
    const content = await load_test_file()

    const train = await app.getTrain({trainNumber: '704Б'}, content)

    // expect(train.name).toBe('Минск-Пассажирский — Витебск')

    expect(train.places.length).toBe(3)
    expect(train.places[0].tickets).toBe(1)
    expect(train.places[1].tickets).toBe(2)
    expect(train.places[2].tickets).toBe(144)

    expect(train.places[0].cost).toBe('26.64')
    expect(train.places[1].cost).toBe('38.48')
    expect(train.places[2].cost).toBe('19.24')

    expect(train.places[0].type).toBe('Сидячий')
    expect(train.places[1].type).toBe('Сидячий')
    expect(train.places[2].type).toBe('Сидячий')
})

test('check get train multiple types', async () => {
    const content = await load_test_file()

    const train = await app.getTrain({trainNumber: '680Б'}, content)

    // expect(train.name).toBe('Гродно - Витебск')
    expect(train.places.length).toBe(2)
    expect(train.places[0].tickets).toBe(42)
    expect(train.places[1].tickets).toBe(5)

    expect(train.places[0].cost).toBe('13.18')
    expect(train.places[1].cost).toBe('18.26')

    expect(train.places[0].type).toBe('Плацкартный')
    expect(train.places[1].type).toBe('Купейный')
})

test('check get train train not exists', async () => {
    const content = await load_test_file()

    const train = await app.getTrain({trainNumber: '100А'}, content)

    expect(train).toBe(null)
})


test('check get train no places', async () => {
    const content = await load_test_file(TEST_FILE_NO_PLACES)

    const train = await app.getTrain({trainNumber: '714Б'}, content)

    expect(train).not.toBe(null)
    expect(train.places.length).toBe(0)
})
