package com.ticketpulse.ui.organizer

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.ticketpulse.domain.model.ScanStatus
import com.ticketpulse.ui.common.LoadingIndicator
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(
    onBack: () -> Unit,
    viewModel: ScannerViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED
        )
    }
    var manualCode by remember { mutableStateOf("") }

    // Request camera permission
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!hasCameraPermission) {
                // For real permission request, we'd use rememberLauncherForActivityResult
                // This is a placeholder - in production, use ActivityResultContracts.RequestPermission
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan Ticket") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(20.dp),
        ) {
            // Camera preview (when permission granted)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(400.dp),
                ) {
                    if (hasCameraPermission) {
                        CameraPreview(
                            onCodeScanned = { code ->
                                if (!uiState.isLocked) {
                                    viewModel.scanCode(code)
                                }
                            },
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Color(0xFF06101F),
                                    RoundedCornerShape(26.dp),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "Camera permission needed",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White,
                                )
                                Text(
                                    text = "Allow camera access to scan tickets at the gate.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF8A95A6),
                                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                                )
                            }
                        }
                    }

                    // Scan box overlay
                    Box(
                        modifier = Modifier
                            .size(230.dp)
                            .align(Alignment.Center),
                    ) {
                        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                            drawRoundRect(
                                color = Color.White.copy(alpha = 0.9f),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(24.dp.toPx()),
                                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3.dp.toPx()),
                            )
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(14.dp)) }

            // Scan result card
            item {
                val scanResult = uiState.scanResult
                val isIdle = scanResult.status == ScanStatus.IDLE
                val bgColor = when (scanResult.status) {
                    ScanStatus.VALID -> Color(0xFFDCFCE7)
                    ScanStatus.DUPLICATE -> Color(0xFFFEF3C7)
                    ScanStatus.INVALID, ScanStatus.NETWORK_ERROR -> Color(0xFFFEE2E2)
                    ScanStatus.IDLE -> MaterialTheme.colorScheme.surface
                }
                val borderColor = when (scanResult.status) {
                    ScanStatus.VALID -> Color(0xFF86EFAC)
                    ScanStatus.DUPLICATE -> Color(0xFFFACC15)
                    ScanStatus.INVALID, ScanStatus.NETWORK_ERROR -> Color(0xFFFCA5A5)
                    ScanStatus.IDLE -> MaterialTheme.colorScheme.outline
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = bgColor),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        val icon = when (scanResult.status) {
                            ScanStatus.VALID -> Icons.Default.CheckCircle
                            ScanStatus.DUPLICATE -> Icons.Default.Warning
                            ScanStatus.INVALID, ScanStatus.NETWORK_ERROR -> Icons.Default.Close
                            ScanStatus.IDLE -> null
                        }
                        if (icon != null) {
                            Icon(icon, contentDescription = null, tint = Color(0xFF071F3A), modifier = Modifier.size(30.dp))
                        }
                        Column {
                            Text(
                                text = if (isIdle) "Awaiting scan" else scanResult.eventTitle.ifBlank { scanResult.detail },
                                style = MaterialTheme.typography.titleSmall,
                            )
                            Text(
                                text = if (isIdle) "Valid scans will admit guests." else scanResult.detail,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF38485C),
                            )
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(14.dp)) }

            // Manual code entry
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedTextField(
                        value = manualCode,
                        onValueChange = { manualCode = it },
                        placeholder = { Text("Paste or type ticket code") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Ascii,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                if (manualCode.isNotBlank()) {
                                    viewModel.scanCode(manualCode.trim())
                                    manualCode = ""
                                }
                            },
                        ),
                        modifier = Modifier.weight(1f).height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        ),
                    )
                    IconButton(
                        onClick = {
                            if (manualCode.isNotBlank()) {
                                viewModel.scanCode(manualCode.trim())
                                manualCode = ""
                            }
                        },
                        modifier = Modifier
                            .size(52.dp)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                RoundedCornerShape(16.dp),
                            ),
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = "Check", tint = Color.White)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(14.dp)) }

            // Recent scans
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = "Recent scans",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        if (uiState.recentScans.isEmpty()) {
                            Text(
                                text = "No scans yet.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        } else {
                            uiState.recentScans.forEach { scan ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(10.dp)
                                            .background(
                                                when (scan.status) {
                                                    ScanStatus.VALID -> Color(0xFF22C55E)
                                                    ScanStatus.DUPLICATE -> Color(0xFFF59E0B)
                                                    else -> Color(0xFFEF4444)
                                                },
                                                RoundedCornerShape(99.dp),
                                            ),
                                    )
                                    Text(
                                        text = scan.title,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.W700,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        text = scan.time,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.outlineVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(32.dp)) }
        }
    }
}

@Composable
private fun CameraPreview(
    onCodeScanned: (String) -> Unit,
) {
    val context = LocalContext.current
    val executor = remember { Executors.newSingleThreadExecutor() }

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }

            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()

                val preview = androidx.camera.core.Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val barcodeAnalyzer = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { analysis ->
                        analysis.setAnalyzer(executor) { imageProxy: ImageProxy ->
                            processImageProxy(imageProxy, onCodeScanned)
                        }
                    }

                val cameraSelector = CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                    .build()

                try {
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        ctx as androidx.lifecycle.LifecycleOwner,
                        cameraSelector,
                        preview,
                        barcodeAnalyzer,
                    )
                } catch (e: Exception) {
                    // Camera binding failed
                }
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(400.dp),
    )
}

private fun processImageProxy(imageProxy: ImageProxy, onCodeScanned: (String) -> Unit) {
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }

    val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    val scanner = BarcodeScanning.getClient()

    scanner.process(inputImage)
        .addOnSuccessListener { barcodes ->
            for (barcode in barcodes) {
                val code = barcode.rawValue
                if (code != null) {
                    onCodeScanned(code)
                    break
                }
            }
        }
        .addOnCompleteListener {
            imageProxy.close()
        }
}
