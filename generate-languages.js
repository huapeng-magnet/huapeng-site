// 生成德语版页面
const fs = require('fs');
const path = require('path');

const DE_TRANS = {
  // 导航
  'Home': 'Startseite',
  'Categories': 'Kategorien',
  'Products': 'Produkte',
  'Quotation': 'Preisliste',
  'About': 'Über uns',
  'Promotions': 'Aktionen',
  'Contact': 'Kontakt',
  'Get a Quote': 'Angebot anfordern',
  'Menu': 'Menü',

  // Hero
  'Instant Pricing': 'Sofortpreis',
  'Online Quotation': 'Online-Preisliste',
  'Real-time USD pricing for': 'Aktuelle USD-Preise für',
  'Nickel-Coated NdFeB magnets': 'Nickel-beschichtete NdFeB-Magnete',
  'Select grade, shape, coating, dimensions and quantity to get an instant estimate':
    'Wählen Sie Sorte, Form, Beschichtung, Abmessungen und Menge für eine sofortige Schätzung',
  'Higher grades and custom shapes are available on request':
    'Höhere Sorten und Sonderformen auf Anfrage verfügbar',

  // Rate bar
  'Real-time exchange rate': 'Aktueller Wechselkurs',
  'for reference only': 'nur zur Orientierung',
  'Loading…': 'Laden…',

  // Calculator
  'Quick Quote': 'Schnellangebot',
  'Grade': 'Sorte',
  'instant price': 'Sofortpreis',
  'request quote': 'Angebot anfordern',
  'Shape': 'Form',
  'Disc': 'Scheibe',
  'Block': 'Block',
  'Ring': 'Ring',
  'Arc / Segment': 'Bogen / Segment',
  'Custom / Irregular': 'Individuell / Unregelmäßig',
  'Diameter (mm)': 'Durchmesser (mm)',
  'Thickness (mm)': 'Dicke (mm)',
  'Length (mm)': 'Länge (mm)',
  'Width (mm)': 'Breite (mm)',
  'Outer Diameter (mm)': 'Außendurchmesser (mm)',
  'Hole Diameter (mm)': 'Lochdurchmesser (mm)',
  'Coating': 'Beschichtung',
  'Nickel': 'Nickel',
  'Zinc': 'Zink',
  'Quantity': 'Menge',
  'Calculate Price': 'Preis berechnen',
  'Estimate': 'Schätzung',
  'Fill in the form and click': 'Füllen Sie das Formular aus und klicken Sie auf',
  'to see your estimate': 'um Ihre Schätzung zu sehen',
  'Non-N35 grades and custom / arc shapes are quoted manually':
    'Nicht-N35-Sorten und Sonder-/Bogenformen werden manuell angeboten',

  // Price list
  'Standard List': 'Standardliste',
  'N35 Nickel-Coated Price List': 'N35 Nickel-beschichtete Preisliste',
  'FOB China basis. Tax included. Prices are listed directly in USD per piece, no currency conversion needed':
    'FOB China Basis. Steuer inbegriffen. Preise direkt in USD pro Stück, keine Währungsumrechnung erforderlich',
  'Other grades and coatings —': 'Andere Sorten und Beschichtungen —',
  'request a quote': 'Angebot anfordern',
  'All': 'Alle',
  'Spec': 'Spezifikation',
  'Pictures': 'Bilder',
  'Price @ 1K': 'Preis @ 1Tsd',
  'Price @ 50K': 'Preis @ 50Tsd',
  'Price @ 500K': 'Preis @ 500Tsd',

  // Grade specs
  'Technical Reference': 'Technische Referenz',
  'Grade & Performance Reference': 'Sorten- & Leistungsreferenz',
  'Select the right energy product and operating temperature for your application':
    'Wählen Sie das richtige Energieprodukt und die Betriebstemperatur für Ihre Anwendung',
  'Br (kGs)': 'Br (kGs)',
  'Hcj (kOe)': 'Hcj (kOe)',
  'BHmax (MGOe)': 'BHmax (MGOe)',
  'Max Working Temp': 'Max Betriebstemperatur',
  'Typical Use': 'Typische Anwendung',

  // CTA
  'Need a formal quote or a custom shape?': 'Brauchen Sie ein offizielles Angebot oder eine Sonderform?',
  'Tell us your grade, coating, tolerance and quantity. We\'ll reply within 24 hours':
    'Teilen Sie uns Ihre Sorte, Beschichtung, Toleranz und Menge mit. Wir antworten innerhalb von 24 Stunden',
  'Contact Sales': 'Vertrieb kontaktieren',

  // Footer
  'Industrial-grade neodymium magnets for motors, sensors, speakers and magnetic assemblies. Global delivery, export-ready documentation':
    'Industrielle Neodym-Magnete für Motoren, Sensoren, Lautsprecher und magnetische Baugruppen. Globale Lieferung, exportfertige Dokumentation',
  'Quick Links': 'Schnelllinks',
  'Email': 'E-Mail',
  'Tel / WhatsApp': 'Tel / WhatsApp',
  'Address': 'Adresse',
  'Compliance': 'Compliance',
  'NdFeB magnets may be subject to export-control and dual-use regulations in your country':
    'NdFeB-Magnete können exportkontroll- und dual-use-Bestimmungen in Ihrem Land unterliegen',
  'We only supply for industrial, electronic and consumer applications':
    'Wir liefern nur für industrielle, elektronische und Verbraucheranwendungen',

  // PDF Export
  'Export PDF': 'PDF exportieren',
  'Quote History': 'Angebotshistorie',
  'No history yet': 'Noch keine Historie',
  'Calculate a quote to save it': 'Berechnen Sie ein Angebot, um es zu speichern',
  'Restore': 'Wiederherstellen',
  'Delete': 'Löschen',
};

function translateHTML(html) {
  let result = html;
  // 替换主要文本内容
  for (const [en, de] of Object.entries(DE_TRANS)) {
    result = result.split(en).join(de);
  }
  // 修改lang属性
  result = result.replace(/<html lang="en">/, '<html lang="de">');
  // 修改标题
  result = result.replace('<title>Quotation — Huapeng Magnetics</title>', '<title>Preisliste — Huapeng Magnetics</title>');
  return result;
}

// 生成德语版
let indexDE = fs.readFileSync('index.html', 'utf8');
let quoteDE = fs.readFileSync('request-quote.html', 'utf8');

indexDE = translateHTML(indexDE);
quoteDE = translateHTML(quoteDE);

fs.writeFileSync(path.join(__dirname, 'de/index.html'), indexDE);
fs.writeFileSync(path.join(__dirname, 'de/request-quote.html'), quoteDE);

// 西班牙语版（类似处理）
const ES_TRANS = {
  'Home': 'Inicio',
  'Categories': 'Categorías',
  'Products': 'Productos',
  'Quotation': 'Presupuesto',
  'About': 'Nosotros',
  'Contact': 'Contacto',
  'Get a Quote': 'Solicitar presupuesto',
  'Instant Pricing': 'Precios instantáneos',
  'Online Quotation': 'Presupuesto en línea',
  'Quick Quote': 'Cotización rápida',
  'Grade': 'Grado',
  'Shape': 'Forma',
  'Coating': 'Recubrimiento',
  'Quantity': 'Cantidad',
  'Calculate Price': 'Calcular precio',
  'Estimate': 'Estimación',
  'N35 Nickel-Coated Price List': 'Lista de precios N35 con recubrimiento de níquel',
  'Export PDF': 'Exportar PDF',
  'Quote History': 'Historial de cotización',
};

function translateES(html) {
  let result = html;
  for (const [en, es] of Object.entries(ES_TRANS)) {
    result = result.split(en).join(es);
  }
  result = result.replace(/<html lang="en">/, '<html lang="es">');
  result = result.replace('<title>Quotation — Huapeng Magnetics</title>', '<title>Presupuesto — Huapeng Magnetics</title>');
  return result;
}

let indexES = fs.readFileSync('index.html', 'utf8');
let quoteES = fs.readFileSync('request-quote.html', 'utf8');

indexES = translateES(indexES);
quoteES = translateES(quoteES);

fs.writeFileSync(path.join(__dirname, 'es/index.html'), indexES);
fs.writeFileSync(path.join(__dirname, 'es/request-quote.html'), quoteES);

console.log('✅ 德语版和西班牙语版页面已生成');
console.log('📁 de/ - 德语版');
console.log('📁 es/ - 西班牙语版');
