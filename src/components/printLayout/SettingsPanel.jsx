import {
  FaBuilding,
  FaImage,
  FaFileInvoice,
  FaUser,
  FaUserTie,
  FaTable,
  FaCalculator,
  FaCreditCard,
  FaNoteSticky,
  FaPenFancy,
  FaQrcode,
  FaAlignLeft,
  FaFile,
  FaPalette,
  FaGripVertical,
} from 'react-icons/fa6';
import { usePrintLayout } from '../../features/printLayout/PrintLayoutContext.jsx';
import {
  BARCODE_TYPES,
  BORDER_STYLES,
  FONT_FAMILIES,
  PAPER_SIZE_OPTIONS,
  PRODUCT_COLUMNS,
  SECTION_LABELS,
} from '../../features/printLayout/printLayoutDefaults.js';
import SettingSection, {
  SettingColorPicker,
  SettingInput,
  SettingSelect,
  SettingToggle,
} from './SettingSection.jsx';
import SortableList from './SortableList.jsx';

function CompanySettings() {
  const { settings, updateSettings } = usePrintLayout();
  const c = settings.company;

  const fields = [
    ['name', 'Company Name'],
    ['legalName', 'Company Legal Name'],
    ['email', 'Company Email'],
    ['phone', 'Company Phone'],
    ['address', 'Company Address'],
    ['city', 'City'],
    ['country', 'Country'],
    ['website', 'Website'],
    ['taxNumber', 'Tax Number'],
    ['ntn', 'NTN'],
    ['strn', 'STRN'],
    ['registrationNumber', 'Registration Number'],
    ['tagline', 'Tagline'],
  ];

  return (
    <SettingSection title="Company Information" icon={FaBuilding} defaultOpen>
      {fields.map(([key, label]) => (
        <SettingInput
          key={key}
          label={label}
          value={c[key] || ''}
          onChange={(v) => updateSettings(`company.${key}`, v)}
        />
      ))}
    </SettingSection>
  );
}

function LogoSettings() {
  const { settings, updateSettings, setLogoFile } = usePrintLayout();
  const logo = settings.logo;

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoFile(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <SettingSection title="Company Logo" icon={FaImage}>
      <div className="pl-logo-upload mb-3">
        {logo.dataUrl ? (
          <img src={logo.dataUrl} alt="Logo preview" className="pl-logo-upload__preview" />
        ) : (
          <div className="pl-logo-upload__empty">No logo uploaded</div>
        )}
        <div className="d-flex gap-2 mt-2">
          <label className="btn btn-sm btn-outline-primary mb-0">
            Upload Logo
            <input type="file" accept="image/*" hidden onChange={handleUpload} />
          </label>
          {logo.dataUrl ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setLogoFile('')}>
              Remove Logo
            </button>
          ) : null}
        </div>
      </div>
      <SettingSelect
        label="Logo Position"
        value={logo.position}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => updateSettings('logo.position', v)}
      />
      <SettingInput
        label="Logo Width (px)"
        type="number"
        min={24}
        max={200}
        value={logo.width}
        onChange={(v) => updateSettings('logo.width', v)}
      />
      <SettingInput
        label="Logo Height (px)"
        type="number"
        min={24}
        max={200}
        value={logo.height}
        onChange={(v) => updateSettings('logo.height', v)}
      />
      <SettingToggle
        label="Maintain Aspect Ratio"
        checked={logo.maintainAspectRatio}
        onChange={(v) => updateSettings('logo.maintainAspectRatio', v)}
      />
    </SettingSection>
  );
}

function HeaderSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const h = settings.header;
  const toggles = [
    ['showLogo', 'Show Logo'],
    ['showCompanyName', 'Show Company Name'],
    ['showAddress', 'Show Address'],
    ['showPhone', 'Show Phone'],
    ['showEmail', 'Show Email'],
    ['showWebsite', 'Show Website'],
    ['showTaxNumber', 'Show Tax Number'],
    ['showInvoiceTitle', 'Show Invoice Title'],
    ['showInvoiceNumber', 'Show Invoice Number'],
    ['showInvoiceDate', 'Show Invoice Date'],
    ['showDueDate', 'Show Due Date'],
  ];

  return (
    <SettingSection title="Invoice Header" icon={FaFileInvoice}>
      {toggles.map(([key, label]) => (
        <SettingToggle
          key={key}
          label={label}
          checked={h[key]}
          onChange={() => toggleSetting(`header.${key}`)}
        />
      ))}
      <SettingSelect
        label="Header Alignment"
        value={h.alignment}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => updateSettings('header.alignment', v)}
      />
    </SettingSection>
  );
}

function CustomerSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const c = settings.customerDisplay;
  const toggles = [
    ['showName', 'Show Customer Name'],
    ['showPhone', 'Show Customer Phone'],
    ['showEmail', 'Show Customer Email'],
    ['showAddress', 'Show Customer Address'],
    ['showTaxNumber', 'Show Customer Tax Number'],
    ['showCustomerId', 'Show Customer ID'],
  ];

  return (
    <SettingSection title="Customer Information" icon={FaUser}>
      {toggles.map(([key, label]) => (
        <SettingToggle
          key={key}
          label={label}
          checked={c[key]}
          onChange={() => toggleSetting(`customerDisplay.${key}`)}
        />
      ))}
      <SettingSelect
        label="Layout"
        value={c.layout}
        options={[
          { value: 'single-column', label: 'Single column' },
          { value: 'two-column', label: 'Two columns' },
        ]}
        onChange={(v) => updateSettings('customerDisplay.layout', v)}
      />
    </SettingSection>
  );
}

function UserSettings() {
  const { settings, toggleSetting } = usePrintLayout();
  const u = settings.userInfo;
  const toggles = [
    ['showCashier', 'Show Cashier'],
    ['showSalesperson', 'Show Salesperson'],
    ['showUserName', 'Show User Name'],
    ['showUserEmail', 'Show User Email'],
    ['showUserPhone', 'Show User Phone'],
    ['showBranch', 'Show Branch'],
    ['showWarehouse', 'Show Warehouse'],
  ];

  return (
    <SettingSection title="User / Salesperson" icon={FaUserTie}>
      {toggles.map(([key, label]) => (
        <SettingToggle
          key={key}
          label={label}
          checked={u[key]}
          onChange={() => toggleSetting(`userInfo.${key}`)}
        />
      ))}
    </SettingSection>
  );
}

function ProductTableSettings() {
  const { settings, updateSettings, setProductColumnOrder } = usePrintLayout();
  const p = settings.products;
  const columnLabels = Object.fromEntries(PRODUCT_COLUMNS.map((c) => [c.id, c.label]));

  const toggleColumn = (colId) => {
    updateSettings(`products.columnVisibility.${colId}`, !p.columnVisibility[colId]);
  };

  return (
    <SettingSection title="Products Table" icon={FaTable}>
      <div className="pl-setting-subtitle">Visible columns & order</div>
      <SortableList
        items={p.columnOrder}
        labels={columnLabels}
        onReorder={setProductColumnOrder}
      />
      <div className="pl-column-toggles mt-2">
        {PRODUCT_COLUMNS.map((col) => (
          <SettingToggle
            key={col.id}
            label={col.label}
            checked={p.columnVisibility[col.id]}
            onChange={() => toggleColumn(col.id)}
          />
        ))}
      </div>
      <SettingInput
        label="Table Font Size"
        type="number"
        min={8}
        max={16}
        value={p.tableFontSize}
        onChange={(v) => updateSettings('products.tableFontSize', v)}
      />
      <SettingInput
        label="Header Font Size"
        type="number"
        min={8}
        max={16}
        value={p.headerFontSize}
        onChange={(v) => updateSettings('products.headerFontSize', v)}
      />
      <SettingInput
        label="Row Spacing"
        type="number"
        min={2}
        max={16}
        value={p.rowSpacing}
        onChange={(v) => updateSettings('products.rowSpacing', v)}
      />
      <SettingSelect
        label="Border Style"
        value={p.borderStyle}
        options={BORDER_STYLES}
        onChange={(v) => updateSettings('products.borderStyle', v)}
      />
      <SettingToggle
        label="Show Table Borders"
        checked={p.showBorders}
        onChange={(v) => updateSettings('products.showBorders', v)}
      />
      {[
        ['headerAlignment', 'Header Alignment'],
        ['productAlignment', 'Product Alignment'],
        ['quantityAlignment', 'Quantity Alignment'],
        ['priceAlignment', 'Price Alignment'],
        ['totalAlignment', 'Total Alignment'],
      ].map(([key, label]) => (
        <SettingSelect
          key={key}
          label={label}
          value={p[key]}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => updateSettings(`products.${key}`, v)}
        />
      ))}
    </SettingSection>
  );
}

function TotalsSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const t = settings.totals;
  const toggles = [
    ['showSubtotal', 'Show Subtotal'],
    ['showDiscount', 'Show Discount'],
    ['showTax', 'Show Tax'],
    ['showShipping', 'Show Shipping'],
    ['showOtherCharges', 'Show Other Charges'],
    ['showGrandTotal', 'Show Grand Total'],
    ['showPaidAmount', 'Show Paid Amount'],
    ['showBalance', 'Show Balance'],
    ['showPaymentMethod', 'Show Payment Method'],
  ];

  return (
    <SettingSection title="Pricing / Totals" icon={FaCalculator}>
      {toggles.map(([key, label]) => (
        <SettingToggle
          key={key}
          label={label}
          checked={t[key]}
          onChange={() => toggleSetting(`totals.${key}`)}
        />
      ))}
      <div className="pl-setting-subtitle mt-2">Grand Total</div>
      <SettingInput
        label="Font Size"
        type="number"
        min={10}
        max={24}
        value={t.grandTotalFontSize}
        onChange={(v) => updateSettings('totals.grandTotalFontSize', v)}
      />
      <SettingToggle
        label="Bold"
        checked={t.grandTotalBold}
        onChange={(v) => updateSettings('totals.grandTotalBold', v)}
      />
      <SettingSelect
        label="Alignment"
        value={t.grandTotalAlignment}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => updateSettings('totals.grandTotalAlignment', v)}
      />
      <SettingToggle
        label="Border"
        checked={t.grandTotalBorder}
        onChange={(v) => updateSettings('totals.grandTotalBorder', v)}
      />
      <SettingToggle
        label="Highlight"
        checked={t.grandTotalHighlight}
        onChange={(v) => updateSettings('totals.grandTotalHighlight', v)}
      />
    </SettingSection>
  );
}

function PaymentSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const p = settings.payment;
  const toggles = [
    ['showPaymentMethod', 'Show Payment Method'],
    ['showPaymentReference', 'Show Payment Reference'],
    ['showTransactionId', 'Show Transaction ID'],
    ['showBankDetails', 'Show Bank Details'],
    ['showCashDetails', 'Show Cash Details'],
    ['showCardDetails', 'Show Card Details'],
  ];

  return (
    <SettingSection title="Payment Information" icon={FaCreditCard}>
      {toggles.map(([key, label]) => (
        <SettingToggle
          key={key}
          label={label}
          checked={p[key]}
          onChange={() => toggleSetting(`payment.${key}`)}
        />
      ))}
      <SettingInput
        label="Bank Details"
        multiline
        value={p.bankDetails}
        onChange={(v) => updateSettings('payment.bankDetails', v)}
      />
      <SettingInput
        label="Cash Details"
        value={p.cashDetails}
        onChange={(v) => updateSettings('payment.cashDetails', v)}
      />
      <SettingInput
        label="Card Details"
        value={p.cardDetails}
        onChange={(v) => updateSettings('payment.cardDetails', v)}
      />
    </SettingSection>
  );
}

function NotesSettings() {
  const { settings, updateSettings } = usePrintLayout();
  const n = settings.notes;
  const fields = [
    ['invoiceNotes', 'Invoice Notes'],
    ['customerNotes', 'Customer Notes'],
    ['paymentTerms', 'Payment Terms'],
    ['returnPolicy', 'Return Policy'],
    ['warrantyInformation', 'Warranty Information'],
    ['footerMessage', 'Footer Message'],
  ];

  return (
    <SettingSection title="Notes & Terms" icon={FaNoteSticky}>
      {fields.map(([key, label]) => (
        <SettingInput
          key={key}
          label={label}
          multiline
          value={n[key] || ''}
          onChange={(v) => updateSettings(`notes.${key}`, v)}
        />
      ))}
    </SettingSection>
  );
}

function SignatureSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const s = settings.signature;

  return (
    <SettingSection title="Signature" icon={FaPenFancy}>
      <SettingToggle
        label="Show Authorized Signature"
        checked={s.showAuthorized}
        onChange={() => toggleSetting('signature.showAuthorized')}
      />
      <SettingToggle
        label="Show Customer Signature"
        checked={s.showCustomer}
        onChange={() => toggleSetting('signature.showCustomer')}
      />
      <SettingSelect
        label="Signature Position"
        value={s.position}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => updateSettings('signature.position', v)}
      />
      <SettingInput
        label="Authorized Label"
        value={s.authorizedLabel}
        onChange={(v) => updateSettings('signature.authorizedLabel', v)}
      />
      <SettingInput
        label="Customer Label"
        value={s.customerLabel}
        onChange={(v) => updateSettings('signature.customerLabel', v)}
      />
    </SettingSection>
  );
}

function QRCodeSettings() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const q = settings.qrBarcode;

  return (
    <SettingSection title="QR / Barcode" icon={FaQrcode}>
      <SettingToggle label="Show QR Code" checked={q.showQrCode} onChange={() => toggleSetting('qrBarcode.showQrCode')} />
      <SettingToggle label="Show Invoice QR" checked={q.showInvoiceQr} onChange={() => toggleSetting('qrBarcode.showInvoiceQr')} />
      <SettingToggle label="Show Payment QR" checked={q.showPaymentQr} onChange={() => toggleSetting('qrBarcode.showPaymentQr')} />
      <SettingToggle label="Show Barcode" checked={q.showBarcode} onChange={() => toggleSetting('qrBarcode.showBarcode')} />
      <SettingSelect label="Barcode Type" value={q.barcodeType} options={BARCODE_TYPES} onChange={(v) => updateSettings('qrBarcode.barcodeType', v)} />
      <SettingInput label="QR Size (px)" type="number" min={32} max={128} value={q.qrSize} onChange={(v) => updateSettings('qrBarcode.qrSize', v)} />
      <SettingSelect
        label="Position"
        value={q.position}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => updateSettings('qrBarcode.position', v)}
      />
    </SettingSection>
  );
}

function FooterSettingsPanel() {
  const { settings, toggleSetting, updateSettings } = usePrintLayout();
  const f = settings.footer;

  return (
    <SettingSection title="Footer" icon={FaAlignLeft}>
      <SettingToggle label="Show Footer" checked={f.showFooter} onChange={() => toggleSetting('footer.showFooter')} />
      <SettingInput label="Footer Text" multiline value={f.footerText} onChange={(v) => updateSettings('footer.footerText', v)} />
      <SettingToggle label="Show Company Name" checked={f.showCompanyName} onChange={() => toggleSetting('footer.showCompanyName')} />
      <SettingToggle label="Show Website" checked={f.showWebsite} onChange={() => toggleSetting('footer.showWebsite')} />
      <SettingToggle label="Show Phone" checked={f.showPhone} onChange={() => toggleSetting('footer.showPhone')} />
      <SettingToggle label="Show Email" checked={f.showEmail} onChange={() => toggleSetting('footer.showEmail')} />
      <SettingToggle label="Show Page Number" checked={f.showPageNumber} onChange={() => toggleSetting('footer.showPageNumber')} />
    </SettingSection>
  );
}

function PageSettings() {
  const { settings, updateSettings } = usePrintLayout();
  const p = settings.page;

  return (
    <SettingSection title="Page Settings" icon={FaFile}>
      <SettingSelect
        label="Paper Size"
        value={p.paperSize}
        options={PAPER_SIZE_OPTIONS.map(({ value, label, description }) => ({
          value,
          label: value === 'custom' ? label : `${label} (${description})`,
        }))}
        onChange={(v) => updateSettings('page.paperSize', v)}
      />
      {p.paperSize === 'custom' ? (
        <>
          <SettingInput
            label="Custom Width (mm)"
            type="number"
            min={50}
            max={500}
            value={p.customWidthMm}
            onChange={(v) => updateSettings('page.customWidthMm', v)}
          />
          <SettingInput
            label="Custom Height (mm)"
            type="number"
            min={50}
            max={600}
            value={p.customHeightMm}
            onChange={(v) => updateSettings('page.customHeightMm', v)}
          />
        </>
      ) : null}
      <SettingSelect
        label="Orientation"
        value={p.orientation}
        options={[
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ]}
        onChange={(v) => updateSettings('page.orientation', v)}
      />
      {['top', 'bottom', 'left', 'right'].map((side) => (
        <SettingInput
          key={side}
          label={`Margin ${side.charAt(0).toUpperCase()}${side.slice(1)} (px)`}
          type="number"
          min={0}
          max={80}
          value={p.margins[side]}
          onChange={(v) => updateSettings(`page.margins.${side}`, v)}
        />
      ))}
      <SettingSelect label="Font Family" value={p.fontFamily} options={FONT_FAMILIES} onChange={(v) => updateSettings('page.fontFamily', v)} />
      <SettingInput label="Base Font Size" type="number" min={8} max={16} value={p.baseFontSize} onChange={(v) => updateSettings('page.baseFontSize', v)} />
      <SettingInput label="Heading Font Size" type="number" min={12} max={28} value={p.headingFontSize} onChange={(v) => updateSettings('page.headingFontSize', v)} />
      <SettingInput label="Table Font Size" type="number" min={8} max={16} value={p.tableFontSize} onChange={(v) => updateSettings('page.tableFontSize', v)} />
      <SettingInput label="Section Spacing" type="number" min={4} max={32} value={p.sectionSpacing} onChange={(v) => updateSettings('page.sectionSpacing', v)} />
      <SettingInput label="Row Spacing" type="number" min={2} max={16} value={p.rowSpacing} onChange={(v) => updateSettings('page.rowSpacing', v)} />
      <SettingInput label="Header Spacing" type="number" min={4} max={32} value={p.headerSpacing} onChange={(v) => updateSettings('page.headerSpacing', v)} />
      <SettingInput label="Footer Spacing" type="number" min={4} max={32} value={p.footerSpacing} onChange={(v) => updateSettings('page.footerSpacing', v)} />
    </SettingSection>
  );
}

function ColorSettings() {
  const { settings, updateSettings, toggleSetting } = usePrintLayout();
  const d = settings.design;

  return (
    <SettingSection title="Design / Styling" icon={FaPalette}>
      <SettingColorPicker label="Primary Color" value={d.primaryColor} onChange={(v) => updateSettings('design.primaryColor', v)} />
      <SettingColorPicker label="Secondary Color" value={d.secondaryColor} onChange={(v) => updateSettings('design.secondaryColor', v)} />
      <SettingColorPicker label="Text Color" value={d.textColor} onChange={(v) => updateSettings('design.textColor', v)} />
      <SettingColorPicker label="Border Color" value={d.borderColor} onChange={(v) => updateSettings('design.borderColor', v)} />
      <SettingColorPicker label="Table Header Background" value={d.tableHeaderBg} onChange={(v) => updateSettings('design.tableHeaderBg', v)} />
      <SettingColorPicker label="Table Header Text" value={d.tableHeaderText} onChange={(v) => updateSettings('design.tableHeaderText', v)} />
      <SettingInput label="Border Radius (px)" type="number" min={0} max={16} value={d.borderRadius} onChange={(v) => updateSettings('design.borderRadius', v)} />
      <SettingInput label="Border Width (px)" type="number" min={0} max={4} value={d.borderWidth} onChange={(v) => updateSettings('design.borderWidth', v)} />
      <SettingSelect label="Divider Style" value={d.dividerStyle} options={BORDER_STYLES.filter((b) => b.value !== 'none')} onChange={(v) => updateSettings('design.dividerStyle', v)} />
      <SettingToggle label="Bold Headings" checked={d.boldHeadings} onChange={(v) => updateSettings('design.boldHeadings', v)} />
      <SettingToggle label="Uppercase Invoice Title" checked={d.uppercaseInvoiceTitle} onChange={(v) => updateSettings('design.uppercaseInvoiceTitle', v)} />
    </SettingSection>
  );
}

function SectionOrderSettings() {
  const { settings, setSectionOrder } = usePrintLayout();

  return (
    <SettingSection title="Section Order" icon={FaGripVertical} defaultOpen>
      <p className="text-muted small mb-2">Drag sections to reorder the invoice layout.</p>
      <SortableList
        items={settings.sectionOrder}
        labels={SECTION_LABELS}
        onReorder={setSectionOrder}
      />
    </SettingSection>
  );
}

export default function SettingsPanel() {
  return (
    <div className="pl-settings-panel">
      <SectionOrderSettings />
      <CompanySettings />
      <LogoSettings />
      <HeaderSettings />
      <CustomerSettings />
      <UserSettings />
      <ProductTableSettings />
      <TotalsSettings />
      <PaymentSettings />
      <NotesSettings />
      <SignatureSettings />
      <QRCodeSettings />
      <FooterSettingsPanel />
      <PageSettings />
      <ColorSettings />
    </div>
  );
}
