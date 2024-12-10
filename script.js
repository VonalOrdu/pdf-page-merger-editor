const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
// const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const pdfPreview = document.getElementById('pdfPreview');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

let pdfFiles = [];
let currentPdf = null;
let currentPage = 1;
let mergedPdfDocument = null;

// Sortable.js ile sürükle-bırak özelliği
new Sortable(fileList, {
  animation: 150,
  onEnd: function () {
    updatePdfFilesOrder();
    updatePageOrder();
    previewMergedPDF();
  }
});

fileInput.addEventListener('change', handleFileSelect);
mergeBtn.addEventListener('click', mergePDFs);
// deleteSelectedBtn.addEventListener('click', deleteSelectedFiles);

async function handleFileSelect(event) {
  const files = event.target.files;
  for (let file of files) {
    if (file.type === 'application/pdf') {
      const pdfDocument = await PDFLib.PDFDocument.load(await file.arrayBuffer());
      const pageCount = pdfDocument.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const page = pdfDocument.getPage(i);
        const { width, height } = page.getSize();

        // Eğer genişlik yükseklikten büyükse, sayfayı 270 derece döndür
        const shouldRotate = width > height;
        const rotation = shouldRotate ? 270 : 0;

        pdfFiles.push({
          file: file,
          pageIndex: i,
          fileName: file.name,
          pageNumber: i + 1,
          rotation: rotation,
          originalWidth: width,
          originalHeight: height
        });
        await addFileToList(pdfFiles[pdfFiles.length - 1]);
      }
    }
    else {
      alert(`${file.name} bir PDF dosyası değil ve atlanacak.`);
    }
  }
  createMergedPDF().then(() => {
    previewMergedPDF();
  });
}



async function addFileToList(pdfPage) {
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="page-order">${pdfPage.pageNumber}</span>
    <span class="page-info">${pdfPage.fileName} - Sayfa ${pdfPage.pageNumber}</span>
  `;
  li.setAttribute('data-file-name', pdfPage.fileName);
  li.setAttribute('data-page-index', pdfPage.pageIndex);

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.classList.add('delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFile(pdfPage.fileName, pdfPage.pageIndex);
  });

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.textContent = '↺';
  rotateLeftBtn.classList.add('rotate-left');
  rotateLeftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    rotatePage(pdfPage, -90);
  });

  const rotateRightBtn = document.createElement('button');
  rotateRightBtn.textContent = '↻';
  rotateRightBtn.classList.add('rotate-right');
  rotateRightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    rotatePage(pdfPage, 90);
  });

  li.appendChild(deleteBtn);
  li.appendChild(rotateLeftBtn);
  li.appendChild(rotateRightBtn);
  li.addEventListener('click', () => {
    const pageIndex = pdfFiles.findIndex(page => page.fileName === pdfPage.fileName && page.pageIndex === pdfPage.pageIndex);
    previewMergedPDF(pageIndex + 1);
  });

  fileList.appendChild(li);
  updatePageOrder();
}

function rotatePage(pdfPage, angle) {
  pdfPage.rotation = (pdfPage.rotation + angle + 360) % 360;
  createMergedPDF().then(() => {
    const pageIndex = pdfFiles.findIndex(page => page.fileName === pdfPage.fileName && page.pageIndex === pdfPage.pageIndex);
    previewMergedPDF(pageIndex + 1);
  });
}

function updatePageOrder() {
  const listItems = fileList.querySelectorAll('li');
  listItems.forEach((li, index) => {
    const pageOrderSpan = li.querySelector('.page-order');
    if (pageOrderSpan) {
      pageOrderSpan.textContent = index + 1;
    }
  });
}


function removeFile(fileName, pageIndex) {
  pdfFiles = pdfFiles.filter(file => !(file.fileName === fileName && file.pageIndex === pageIndex));
  const li = fileList.querySelector(`li[data-file-name="${fileName}"][data-page-index="${pageIndex}"]`);
  if (li) li.remove();
  updatePageOrder();
  createMergedPDF().then(() => {
    previewMergedPDF();
  });
}

function updatePdfFilesOrder() {
  const newOrder = Array.from(fileList.children).map(li => ({
    fileName: li.getAttribute('data-file-name'),
    pageIndex: parseInt(li.getAttribute('data-page-index'))
  }));
  pdfFiles.sort((a, b) => {
    const aIndex = newOrder.findIndex(item => item.fileName === a.fileName && item.pageIndex === a.pageIndex);
    const bIndex = newOrder.findIndex(item => item.fileName === b.fileName && item.pageIndex === b.pageIndex);
    return aIndex - bIndex;
  });
  updatePageOrder();
  createMergedPDF().then(() => {
    previewMergedPDF();
  });
}

function deleteSelectedFiles() {
  const selectedItems = fileList.querySelectorAll('li.selected');
  selectedItems.forEach(li => {
    const fileName = li.getAttribute('data-file-name');
    removeFile(fileName);
  });
  previewMergedPDF();
}

async function mergePDFs() {
  if (pdfFiles.length === 0) {
    alert('Lütfen en az bir PDF dosyası seçin.');
    return;
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const pdfPage of pdfFiles) {
    const pdfBytes = await pdfPage.file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(pdfBytes);
    const [copiedPage] = await mergedPdf.copyPages(pdf, [pdfPage.pageIndex]);
    copiedPage.setRotation(PDFLib.degrees(pdfPage.rotation));
    mergedPdf.addPage(copiedPage);
  }

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'merged.pdf';
  link.click();
}


async function previewPDF(file) {
  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const loadingTask = pdfjsLib.getDocument(typedarray);
    currentPdf = await loadingTask.promise;
    currentPage = 1;
    renderPage(currentPage);
    updatePageInfo();
  };
  fileReader.readAsArrayBuffer(file);
}

async function previewMergedPDF(goToPage = 1) {
  if (pdfFiles.length === 0) {
    pdfPreview.getContext('2d').clearRect(0, 0, pdfPreview.width, pdfPreview.height);
    currentPdf = null;
    mergedPdfDocument = null;
    updatePageInfo();
    return;
  }

  if (!mergedPdfDocument) {
    await createMergedPDF();
  }

  // Her zaman yeni bir currentPdf oluştur
  const pdfBytes = await mergedPdfDocument.save();
  const loadingTask = pdfjsLib.getDocument(pdfBytes);
  currentPdf = await loadingTask.promise;

  currentPage = Math.min(goToPage, currentPdf.numPages);
  renderPage(currentPage);
  updatePageInfo();
  highlightSelectedPage(currentPage);
}

async function createMergedPDF() {
  mergedPdfDocument = await PDFLib.PDFDocument.create();

  for (const pdfPage of pdfFiles) {
    const pdfBytes = await pdfPage.file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(pdfBytes);
    const [copiedPage] = await mergedPdfDocument.copyPages(pdf, [pdfPage.pageIndex]);

    // Orijinal boyutları ve rotasyonu uygula
    copiedPage.setRotation(PDFLib.degrees(pdfPage.rotation));
    copiedPage.setSize(pdfPage.originalWidth, pdfPage.originalHeight);

    mergedPdfDocument.addPage(copiedPage);
  }
}

async function renderPage(pageNumber) {
  if (!currentPdf) return;

  const page = await currentPdf.getPage(pageNumber);
  const scale = 1.5;

  // Sayfanın rotasyonunu al
  const rotation = pdfFiles[pageNumber - 1].rotation;

  // Rotasyonu viewport'a ekle
  const viewport = page.getViewport({ scale: scale, rotation: rotation });

  pdfPreview.height = viewport.height;
  pdfPreview.width = viewport.width;
  const context = pdfPreview.getContext('2d');
  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };
  await page.render(renderContext);
}

function updatePageInfo() {
  if (currentPdf) {
    pageInfo.textContent = `Sayfa ${currentPage} / ${currentPdf.numPages}`;
  } else {
    pageInfo.textContent = 'Sayfa 0 / 0';
  }
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = !currentPdf || currentPage >= currentPdf.numPages;
}

prevPageBtn.addEventListener('click', () => {
  if (currentPdf && currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
    updatePageInfo();
  }
});

nextPageBtn.addEventListener('click', () => {
  if (currentPdf && currentPage < currentPdf.numPages) {
    currentPage++;
    renderPage(currentPage);
    updatePageInfo();
  }
});


function highlightSelectedPage(pageNumber) {
  const listItems = fileList.querySelectorAll('li');
  listItems.forEach((li, index) => {
    if (index === pageNumber - 1) {
      li.classList.add('selected');
    } else {
      li.classList.remove('selected');
    }
  });
}



document.addEventListener('DOMContentLoaded', function () {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const addFileBtn = document.getElementById('addFileBtn');

  addFileBtn.addEventListener('click', () => {
    fileInput.click();
  });


  dropZone.addEventListener('click', (e) => {
    // Eğer tıklanan yer tam olarak dropZone ise (içindeki elemanlara tıklanmadıysa)
    if (e.target === dropZone) {
      fileInput.click(); // fileInput'u programatik olarak tıkla
    }
  });

  // Tüm sayfa için sürükleme olayları
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.target === document || e.target === document.body) {
      dropZone.classList.remove('active');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    handleFileSelect({ target: { files: e.dataTransfer.files } });
  });

  // dropZone'un dışına tıklandığında kapatma
  dropZone.addEventListener('click', (e) => {
    if (e.target === dropZone) {
      dropZone.classList.remove('active');
    }
  });
});
