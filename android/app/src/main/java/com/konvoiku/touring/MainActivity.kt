package com.konvoiku.touring

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.konvoiku.touring.ui.navigation.ConvoyNavGraph
import com.konvoiku.touring.ui.theme.KonvoiKuTheme
import org.osmdroid.config.Configuration

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Configuration.getInstance().apply {
            userAgentValue = packageName
        }
        enableEdgeToEdge()
        setContent {
            KonvoiKuTheme {
                ConvoyNavGraph()
            }
        }
    }
}
