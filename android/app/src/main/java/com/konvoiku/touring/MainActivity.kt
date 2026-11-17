package com.konvoiku.touring

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.google.android.gms.maps.MapsApiSettings
import com.konvoiku.touring.ui.navigation.ConvoyNavGraph
import com.konvoiku.touring.ui.theme.KonvoiKuTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapsApiSettings.addInternalUsageAttributionId(
            this,
            "gmp_mcp_codeassist_v1_aistudio"
        )
        enableEdgeToEdge()
        setContent {
            KonvoiKuTheme {
                ConvoyNavGraph()
            }
        }
    }
}
