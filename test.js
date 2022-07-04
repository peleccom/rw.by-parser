const app = require('./index');

jest.setTimeout(60000)
const TEST_FILE = `file://${__dirname}/tests/test.html`;

xtest('test 1', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const res = await app.startTicketsParser({
        from: "Минск",
        to: "Витебск",
        date: today,
        trainNumber: '704Б',
        ticketCount: 1,
    })
    console.log(res)
    expect(1).toBe(1);
});

test('check get train', async () => {
    let browser, page;
    ({browser, page} = await app.createBrowserPage(TEST_FILE))


    const train = await app.getTrain({trainNumber: '704Б'}, page)
    await browser.close()

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
    let browser, page;
    ({browser, page} = await app.createBrowserPage(TEST_FILE))

    const train = await app.getTrain({trainNumber: '680Б'}, page)
    await browser.close()

    expect(train.places.length).toBe(2)
    expect(train.places[0].tickets).toBe(42)
    expect(train.places[1].tickets).toBe(5)

    expect(train.places[0].cost).toBe('13.18')
    expect(train.places[1].cost).toBe('18.26')

    expect(train.places[0].type).toBe('Плацкартный')
    expect(train.places[1].type).toBe('Купейный')
})
