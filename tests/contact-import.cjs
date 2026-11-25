const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),m,m.exports);return m.exports;}
const {contactValues,contactPreview,importedPhone,pickDeviceContacts,parseContactFile}=load('src/lib/contact-import.ts');
(async()=>{
 assert.equal(importedPhone('98765 43210'),'+919876543210');assert.equal(importedPhone('+1 (202) 555-0123'),'+12025550123');assert.equal(importedPhone('123'),'');
 assert.equal(contactValues({name:'Test',phone:'9876543210'}).error,null);assert.match(contactValues({name:'',phone:'9876543210'}).error,/Name/);assert.match(contactValues({name:'Test',email:'test@example.com'}).error,/mobile/);assert.match(contactValues({name:'Test',phone:'9876543210',email:'bad'}).error,/email/);
 let pickerCalled=false;
 const picking=pickDeviceContacts({select:(fields,options)=>{pickerCalled=true;assert.deepEqual(fields,['name','tel']);assert.deepEqual(options,{multiple:true});return Promise.resolve([{name:['Test'],tel:['123','9876543210','+919876543210','+12025550123']},{name:[],tel:['9876543211']}]);}});
 assert(pickerCalled,'Picker must open synchronously in the tap handler');const picked=await picking;assert.equal(picked[0].phone,'+919876543210');assert.deepEqual(picked[0].phoneOptions,['+919876543210','+12025550123']);assert.equal(picked[1].name,'');
 assert.deepEqual(await pickDeviceContacts({select:async()=>[]}),[]);
 await assert.rejects(pickDeviceContacts({select:async()=>{throw new DOMException('Cancelled','AbortError');}}),{name:'AbortError'});
 let preview=contactPreview([{name:'Test',phone:'9876543210'},{name:'Duplicate',phone:'+919876543210'},{name:'Missing phone',email:'optional@example.com'},{name:'',phone:'9876543212'}],[]);
 assert.equal(preview[0].selected,true);assert.equal(preview[1].isDuplicate,true);assert.equal(preview[2].isInvalid,true);assert.equal(preview[3].isInvalid,true);
 assert(contactPreview([{name:'Test',phone:'9876543210'}],[{phone:'+919876543210'}])[0].isDuplicate);
 assert(!contactPreview([{name:'',phone:'9876543210'},{name:'Valid',phone:'9876543210'}],[])[1].isDuplicate);
 let parsed=parseContactFile('Name,Mobile,Email\n"Guest, One",9876543210,\nGuest Two,+12025550123,two@example.com','test.csv');assert.equal(parsed[0].name,'Guest, One');assert.equal(parsed[0].phone,'9876543210');assert.equal(parsed[0].email,'');assert.equal(parsed[1].email,'two@example.com');
 assert.equal(parseContactFile('Name,Email,Phone\nGuest,test@example.com,9876543210','legacy.csv')[0].phone,'9876543210');
 assert.equal(parseContactFile('Guest,9876543210','test.csv')[0].phone,'9876543210');
 parsed=parseContactFile('BEGIN:VCARD\nVERSION:3.0\nFN:Test\\, Guest\nTEL;TYPE=CELL:9876543210\nTEL;TYPE=HOME:+12025550123\nEND:VCARD','test.vcf');assert.equal(parsed[0].name,'Test, Guest');assert.equal(parsed[0].phoneOptions.length,2);assert.equal(parsed[0].email,'');
 assert.throws(()=>parseContactFile('"broken,name','test.csv'),/quoted/);
 console.log('PASS: picker requests names/numbers only, multiple-number selection, cancellation, India/international phones, required fields, optional email, duplicate detection, CSV/vCard parsing. No real contacts accessed.');
})().catch(e=>{console.error(e);process.exitCode=1});
