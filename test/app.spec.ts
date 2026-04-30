import { test, expect } from '@playwright/test';

// กำหนด Base URL ของ Server
const BASE_URL = 'https://ropa2077-frontend.vercel.app';

export function generateRopaMockData() {
  const timestamp = Date.now(); // สร้างตัวเลขที่ไม่ซ้ำกันด้วยเวลาปัจจุบัน

  // ฟังก์ชันสุ่มค่าใน Array
  const getRandomOption = (options: string[]) => options[Math.floor(Math.random() * options.length)];

  return {
    controllerInfo: `บมจ. ตัวอย่าง คอร์ปอเรชั่น (${timestamp})`,
    activityName: `กิจกรรมการตลาดและการขาย รอบที่ ${timestamp}`,
    purpose: `เพื่อนำเสนอโปรโมชั่นให้ลูกค้า - ${timestamp}`,
    collectedData: `ชื่อ, เบอร์โทร, อีเมล, ประวัติการซื้อ (${timestamp})`,
    dataCategory: `ลูกค้าทั่วไป และสมาชิก VIP (${timestamp})`,
    
    // สำหรับ Select Options (สามารถสุ่ม หรือฟิกซ์ค่าที่ต้องการเทสได้)
    dataType: getRandomOption(['ข้อมูลทั่วไป', 'ข้อมูลอ่อนไหว']), 
    collectionFormat: getRandomOption(['Soft File', 'Hard Copy']),
    isDirectFromSubject: 'ใช่', 
    legalBasis: 'Public Task (ฐานภารกิจของรัฐ)', 
    
    minorUnder10: `ผู้ปกครองให้ความยินยอมผ่านแบบฟอร์ม - ${timestamp}`,
    minor10to20: `ขอความยินยอมตามมาตรา 21 - ${timestamp}`,
    
    cbIsTransferred: 'ไม่มี',
    cbIsIntraGroup: 'ไม่ใช่',
    transferMethod: `SFTP / VPN Secure - ${timestamp}`,
    destinationStandard: `ISO/IEC 27001 - ${timestamp}`,
    sectionException: `ข้อยกเว้นตามมาตรา 28 - ${timestamp}`,
    
    storageFormat: `ฐานข้อมูล PostgreSQL และ Backup - ${timestamp}`,
    storageMethod: `Cloud Storage แบบเข้ารหัส - ${timestamp}`,
    retentionPeriod: `10 ปีนับจากสิ้นสุดสัญญา - ${timestamp}`,
    accessRights: `Role-Based Access Control (เฉพาะพนักงานที่เกี่ยวข้อง) - ${timestamp}`,
    destructionMethod: `ลบออกจากระบบ (Hard Delete) - ${timestamp}`,
    disclosureWithoutConsent: `เปิดเผยต่อศาลหรือพนักงานสอบสวนตามหมายเรียก - ${timestamp}`,
    dsarRejectionRecord: `กรณีส่งผลกระทบต่อสิทธิเสรีภาพบุคคลอื่น - ${timestamp}`,
    
    secOrganizational: `มีนโยบายรักษาความมั่นคงปลอดภัย (ISMS) - ${timestamp}`,
    secTechnical: `Data Encryption in Transit & at Rest - ${timestamp}`,
    secPhysical: `ระบบ Keycard Access ห้อง Server - ${timestamp}`,
    secAccessControl: `จำกัดสิทธิ์ระดับ Least Privilege - ${timestamp}`,
    secUserResponsibility: `ระบุในสัญญาจ้างและ NDA - ${timestamp}`,
    secAuditTrail: `เก็บ Log การเข้าถึงข้อมูลย้อนหลัง 90 วัน - ${timestamp}`
  };
}

test.describe('Authentication & Public Pages', () => {
  test('should render login page and components correctly', async ({ page }) => {
    // 1. ไปที่หน้า Login
    await page.goto(`${BASE_URL}/login`,{
      waitUntil: 'domcontentloaded',
    });

    // 2. ตรวจสอบว่า URL ถูกต้อง
    await expect(page).toHaveURL(`${BASE_URL}/login`);

    // 3. ตรวจสอบว่ามี Input สำหรับกรอกข้อมูลแสดงอยู่ (ปรับ Locator ตาม DOM จริงของโปรเจกต์)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /login|เข้าสู่ระบบ/i })).toBeVisible();
  });
});

test.describe('Protected Pages (Requires Authentication)', () => {
  // ทำการ Login ก่อนเริ่มแต่ละ Test ในกลุ่มนี้
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE_URL}/login`);

    // ใส่ Email และ Password ตามที่กำหนด
    await page.locator('input[type="email"]').fill('hattakorn49@gmail.com');
    await page.locator('input[type="password"]').fill('gusto1234');
    
    // กดปุ่ม Login
    await page.getByRole('button', { name: /login|เข้าสู่ระบบ/i }).click();
    // await page.waitForURL('**/users', { timeout: 45000 });
    // รอจนกว่าระบบจะ Redirect ไปที่ Dashboard เพื่อให้แน่ใจว่า Login สำเร็จ
    await page.waitForURL(`${BASE_URL}/users`, { 
      timeout: 45000, 
      waitUntil: 'domcontentloaded' 
    });
    // await expect(page.getByRole('textbox', { name: 'ค้นหาด้วยชื่อหรืออีเมล' })).toBeVisible({ timeout: 45000 });
  });

  test('should access /dashboard successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    // ตัวอย่างการตรวจสอบเพิ่มเติม: ตรวจสอบว่ามี Heading ของ Dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should access /dpo successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/dpo`);
    
    await expect(page).toHaveURL(`${BASE_URL}/dpo`);
  });

  test('should access /ropa/controller successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/ropa/controller`);
    await page.getByRole('button', { name: 'เพิ่มกิจกรรมใหม่' }).click();
    const mockData = generateRopaMockData();
    await page.getByRole('textbox', { name: 'ข้อมูลเกี่ยวกับผู้ควบคุมข้อมูลส่วนบุคคล' }).fill(mockData.controllerInfo);
    await page.getByRole('textbox', { name: 'กิจกรรมประมวลผล' }).fill(mockData.activityName);
    await page.getByRole('textbox', { name: 'วัตถุประสงค์', exact: true }).fill(mockData.purpose);
    await page.getByRole('textbox', { name: 'ข้อมูลส่วนบุคคลที่จัดเก็บ' }).fill(mockData.collectedData);
    await page.getByRole('textbox', { name: 'หมวดหมู่ของข้อมูล' }).fill(mockData.dataCategory);
    
    await page.getByLabel('ประเภทของข้อมูล').click();
    await page.getByLabel('ประเภทของข้อมูล').selectOption(mockData.dataType);
    await page.getByLabel('วิธีการได้มาซึ่งข้อมูล').click();
    await page.getByLabel('วิธีการได้มาซึ่งข้อมูล').selectOption(mockData.collectionFormat);
    await page.getByLabel('ฐานในการประมวลผล').click();
    await page.getByLabel('ฐานในการประมวลผล').selectOption(mockData.legalBasis);
    
    await page.getByRole('textbox', { name: 'ยินยอมผู้เยาว์อายุไม่เกิน 10' }).fill(mockData.minorUnder10);
    await page.getByRole('textbox', { name: 'ยินยอมผู้เยาว์อายุ 10 ถึง 20' }).fill(mockData.minor10to20);
    
    await page.getByLabel('ส่งหรือโอนไปต่างประเทศหรือไม่').click();
    await page.getByLabel('ส่งหรือโอนไปต่างประเทศหรือไม่').selectOption(mockData.cbIsTransferred);
    await page.getByLabel('ส่งให้บริษัทในเครือต่างประเทศหรือไม่').click();
    await page.getByLabel('ส่งให้บริษัทในเครือต่างประเทศหรือไม่').selectOption(mockData.cbIsIntraGroup);
    
    await page.getByRole('textbox', { name: 'วิธีการโอนข้อมูล' }).fill(mockData.transferMethod);
    await page.getByRole('textbox', { name: 'มาตรฐานประเทศปลายทาง' }).fill(mockData.destinationStandard);
    await page.getByRole('textbox', { name: 'ข้อยกเว้นตามมาตรา' }).fill(mockData.sectionException);
    
    await page.getByRole('textbox', { name: 'ประเภทข้อมูลที่จัดเก็บ' }).fill(mockData.storageFormat);
    await page.getByRole('textbox', { name: 'วิธีการเก็บรักษาข้อมูล' }).fill(mockData.storageMethod);
    await page.getByRole('textbox', { name: 'ระยะเวลาเก็บรักษา' }).fill(mockData.retentionPeriod);
    await page.getByRole('textbox', { name: 'สิทธิและวิธีการเข้าถึง' }).fill(mockData.accessRights);
    await page.getByRole('textbox', { name: 'วิธีทำลายข้อมูล' }).fill(mockData.destructionMethod);
    await page.getByRole('textbox', { name: 'การเปิดเผยข้อมูลโดยไม่ต้องขอความยินยอม' }).fill(mockData.disclosureWithoutConsent);
    await page.getByRole('textbox', { name: 'การปฏิเสธคำขอ' }).fill(mockData.dsarRejectionRecord);
    
    await page.getByRole('textbox', { name: 'มาตรการเชิงองค์กร' }).fill(mockData.secOrganizational);
    await page.getByRole('textbox', { name: 'มาตรการเชิงเทคนิค' }).fill(mockData.secTechnical);
    await page.getByRole('textbox', { name: 'มาตรการทางกายภาพ' }).fill(mockData.secPhysical);
    await page.getByRole('textbox', { name: 'การควบคุมการเข้าถึงข้อมูล' }).fill(mockData.secAccessControl);
    await page.getByRole('textbox', { name: 'การกำหนดหน้าที่ผู้ใช้งาน' }).fill(mockData.secUserResponsibility);
    await page.getByRole('textbox', { name: 'มาตรการตรวจสอบย้อนหลัง' }).fill(mockData.secAuditTrail);

    // 4. กดส่งขออนุมัติ
    await page.getByRole('button', { name: 'ส่งขออนุมัติ' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/ropa/controller`);
  });

  test('should access /ropa/processor successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/ropa/processor`);
    await page.getByRole('button', { name: 'เพิ่มกิจกรรมใหม่' }).click();
    const mockData = generateRopaMockData();
    await page.getByRole('textbox', { name: 'ชื่อผู้ประมวลผลข้อมูลส่วนบุคคล' }).fill(mockData.controllerInfo);
    await page.getByRole('textbox', { name: 'ที่อยู่ผู้ควบคุมข้อมูลส่วนบุคคล' }).fill(mockData.controllerInfo);
    await page.getByRole('textbox', { name: 'กิจกรรมประมวลผล' }).fill(mockData.activityName);
    await page.getByRole('textbox', { name: 'วัตถุประสงค์', exact: true }).fill(mockData.purpose);
    await page.getByRole('textbox', { name: 'ข้อมูลส่วนบุคคลที่จัดเก็บ' }).fill(mockData.collectedData);
    await page.getByRole('textbox', { name: 'หมวดหมู่ของข้อมูล' }).fill(mockData.dataCategory);
    await page.getByLabel('ประเภทของข้อมูล').click();
    await page.getByLabel('ประเภทของข้อมูล').selectOption(mockData.dataType);
    await page.getByLabel('วิธีการได้มาซึ่งข้อมูล').click();
    await page.getByLabel('วิธีการได้มาซึ่งข้อมูล').selectOption(mockData.collectionFormat);
    await page.getByLabel('ฐานในการประมวลผล').click();
    await page.getByLabel('ฐานในการประมวลผล').selectOption(mockData.legalBasis);
    
    await page.getByLabel('ส่งหรือโอนไปต่างประเทศหรือไม่').click();
    await page.getByLabel('ส่งหรือโอนไปต่างประเทศหรือไม่').selectOption(mockData.cbIsTransferred);
    await page.getByLabel('ส่งให้บริษัทในเครือต่างประเทศหรือไม่').click();
    await page.getByLabel('ส่งให้บริษัทในเครือต่างประเทศหรือไม่').selectOption(mockData.cbIsIntraGroup);
    
    await page.getByRole('textbox', { name: 'วิธีการโอนข้อมูล' }).fill(mockData.transferMethod);
    await page.getByRole('textbox', { name: 'มาตรฐานประเทศปลายทาง' }).fill(mockData.destinationStandard);
    await page.getByRole('textbox', { name: 'ข้อยกเว้นตามมาตรา' }).fill(mockData.sectionException);
    
    await page.getByRole('textbox', { name: 'ประเภทข้อมูลที่จัดเก็บ' }).fill(mockData.storageFormat);
    await page.getByRole('textbox', { name: 'วิธีการเก็บรักษาข้อมูล' }).fill(mockData.storageMethod);
    await page.getByRole('textbox', { name: 'ระยะเวลาเก็บรักษา' }).fill(mockData.retentionPeriod);
    await page.getByRole('textbox', { name: 'สิทธิและวิธีการเข้าถึง' }).fill(mockData.accessRights);
    await page.getByRole('textbox', { name: 'วิธีทำลายข้อมูล' }).fill(mockData.destructionMethod);
    
    await page.getByRole('textbox', { name: 'มาตรการเชิงองค์กร' }).fill(mockData.secOrganizational);
    await page.getByRole('textbox', { name: 'มาตรการเชิงเทคนิค' }).fill(mockData.secTechnical);
    await page.getByRole('textbox', { name: 'มาตรการทางกายภาพ' }).fill(mockData.secPhysical);
    await page.getByRole('textbox', { name: 'การควบคุมการเข้าถึงข้อมูล' }).fill(mockData.secAccessControl);
    await page.getByRole('textbox', { name: 'การกำหนดหน้าที่ผู้ใช้งาน' }).fill(mockData.secUserResponsibility);
    await page.getByRole('textbox', { name: 'มาตรการตรวจสอบย้อนหลัง' }).fill(mockData.secAuditTrail);

    // 4. กดส่งขออนุมัติ
    await page.getByRole('button', { name: 'ส่งขออนุมัติ' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/ropa/processor`);
  });

  test('should access /users successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/users`);
    const timestamp = Date.now();
    const newUser = {
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      phone: '0812345679',
      address: '123 Test Road, Bangkok',
      password: 'Password123!',
      role: 'System Admin', 
      dept: 'IT'    
    };
    await page.getByRole('button', { name: 'สร้างบัญชีผู้ใช้ใหม่' }).click();
    await page.locator('#user_name').fill(newUser.name);
    await page.locator('#user_email').fill(newUser.email);
    await page.locator('#user_phone').fill(newUser.phone);
    await page.locator('#user_address').fill(newUser.address);
    await page.locator('#user_password').fill(newUser.password);
    await page.locator('#user_role').selectOption(newUser.role);
    await page.locator("#user_dept").selectOption(newUser.dept);
    await page.getByRole('button', { name: 'บันทึกข้อมูล' }).click();
    await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  });
});