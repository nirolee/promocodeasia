() => {
  const tables = Array.from(document.querySelectorAll('table')).map(table => {
    const grid = [];
    Array.from(table.querySelectorAll('tr')).forEach((row, rowIndex) => {
      grid[rowIndex] ??= [];
      let column = 0;
      Array.from(row.children).forEach(cell => {
        while (grid[rowIndex][column] !== undefined) column++;
        const rowSpan = Math.min(Number(cell.getAttribute('rowspan') || 1), 100);
        const colSpan = Math.min(Number(cell.getAttribute('colspan') || 1), 30);
        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++) {
          grid[rowIndex + rowOffset] ??= [];
          for (let colOffset = 0; colOffset < colSpan; colOffset++) {
            grid[rowIndex + rowOffset][column + colOffset] = cell.innerText.trim();
          }
        }
        column += colSpan;
      });
    });
    return grid;
  });
  const cards = Array.from(document.querySelectorAll('.claim-coupon__card')).map(element => element.innerText);
  const sections = Array.from(document.querySelectorAll('.promo-title-section')).map(element => ({
    heading: element.querySelector('h1,h2,h3,h4')?.innerText || '',
    text: element.innerText,
  })).filter(section => /活動內容|注意事項|使用條款|優惠說明|活動辦法/.test(section.heading));
  return {
    url: document.URL,
    title: document.title,
    capturedAt: new Date().toISOString(),
    text: cards.length && sections.length ? [...cards, ...sections.map(section => section.text)].join('\n') : document.body.innerText,
    tables,
    cards,
    sections,
    links: Array.from(document.querySelectorAll('a[href]')).map(element => ({
      text: element.innerText.trim(), url: element.href,
    })).filter(link => /條款|細則|注意事項|活動辦法|優惠詳情|使用說明/.test(link.text)),
  };
}
