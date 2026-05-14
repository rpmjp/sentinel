import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
// d3-scale removed — using a manual interpolator below
import { Globe, Flag, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useGeoUs, useGeoWorld, type GeoBucket } from "@/lib/hooks";
import { fmtCurrencyCompact, fmtNumber } from "@/lib/format";

const WORLD_GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const US_GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type View = "world" | "us";
type Metric = "volume" | "fraud_rate";

/**
 * Interactive choropleth map. World view colors countries by transaction
 * volume or fraud rate. US view drills into states. Clicking a region
 * navigates to /investigate filtered by that country or region.
 */
export function GeoMap() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("world");
  const [metric, setMetric] = useState<Metric>("volume");
  const [hover, setHover] = useState<GeoBucket | null>(null);

  const world = useGeoWorld();
  const us = useGeoUs();

  const buckets = view === "world" ? world.data ?? [] : us.data ?? [];
  const byCode = new Map(buckets.map((b) => [b.code, b]));

  const maxValue = Math.max(
    1,
    ...buckets.map((b) => (metric === "volume" ? b.count : b.fraud_rate)),
  );

  // Manual sqrt scale: t in [0, maxValue] -> coral rgba.
  // sqrt curve gives more contrast at low values, matching d3's scaleSequentialPow(0.5).
  function color(v: number): string {
    if (maxValue <= 0) return "rgba(216, 90, 48, 0.05)";
    const t = Math.max(0, Math.min(1, Math.sqrt(v / maxValue)));
    return `rgba(216, 90, 48, ${0.05 + t * 0.85})`;
  }

  function handleClick(code: string | undefined) {
    if (!code) return;
    if (view === "world") {
      navigate(`/investigate?country=${encodeURIComponent(code)}`);
    } else {
      navigate(`/investigate?region=${encodeURIComponent(code)}`);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-2"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            {view === "world" ? <Globe size={11} /> : <Flag size={11} />}
            Geographic distribution
          </div>
          <div className="text-xs" style={{ color: "var(--color-fg-faint)" }}>
            Click a region to investigate · synthetic KYC enrichment, see note
            below
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Toggle<View>
            value={view}
            options={[
              { v: "world", l: "world" },
              { v: "us", l: "us states" },
            ]}
            onChange={setView}
          />
          <Toggle<Metric>
            value={metric}
            options={[
              { v: "volume", l: "volume" },
              { v: "fraud_rate", l: "fraud rate" },
            ]}
            onChange={setMetric}
          />
        </div>
      </div>

      <div
        className="relative rounded-md overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          height: 380,
        }}
      >
        {view === "world" ? (
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 150 }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup center={[0, 20]} maxZoom={6}>
              <Geographies geography={WORLD_GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const iso3 = M49_TO_ISO3[String(geo.id)];
                    const bucket = iso3 ? byCode.get(iso3) : undefined;
                    const value =
                      bucket == null
                        ? 0
                        : metric === "volume"
                        ? bucket.count
                        : bucket.fraud_rate;
                    const fill = bucket ? color(value) : "var(--color-surface-elevated)";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="var(--color-border)"
                        strokeWidth={0.3}
                        onMouseEnter={() => bucket && setHover(bucket)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => handleClick(bucket?.code)}
                        style={{
                          default: { outline: "none", cursor: bucket ? "pointer" : "default" },
                          hover: { outline: "none", fill: "var(--color-brand)" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        ) : (
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 800 }}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={US_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  // us-atlas uses state name in geo.properties.name; map to abbr
                  const stateName: string = geo.properties.name;
                  const abbr = STATE_NAME_TO_ABBR[stateName];
                  const bucket = abbr ? byCode.get(abbr) : undefined;
                  const value =
                    bucket == null
                      ? 0
                      : metric === "volume"
                      ? bucket.count
                      : bucket.fraud_rate;
                  const fill = bucket ? color(value) : "var(--color-surface-elevated)";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="var(--color-border)"
                      strokeWidth={0.4}
                      onMouseEnter={() =>
                        bucket && setHover({ ...bucket, name: stateName })
                      }
                      onMouseLeave={() => setHover(null)}
                      onClick={() => handleClick(bucket?.code)}
                      style={{
                        default: { outline: "none", cursor: bucket ? "pointer" : "default" },
                        hover: { outline: "none", fill: "var(--color-brand)" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        )}

        {/* Hover tooltip */}
        {hover && (
          <div
            className="absolute top-3 left-3 px-3 py-2 rounded-md text-xs pointer-events-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <div className="font-medium mb-0.5">{hover.name}</div>
            <div className="font-mono" style={{ color: "var(--color-fg-subtle)" }}>
              {fmtNumber(hover.count)} txns ·{" "}
              <span style={{ color: "var(--color-brand)" }}>
                {(hover.fraud_rate * 100).toFixed(1)}% fraud
              </span>
            </div>
            <div
              className="font-mono"
              style={{ color: "var(--color-fg-faint)" }}
            >
              {fmtCurrencyCompact(hover.total_amount)}
            </div>
          </div>
        )}
      </div>

      <div
        className="text-[10px] mt-3 flex items-start gap-1.5"
        style={{ color: "var(--color-fg-faint)" }}
      >
        <Info size={10} className="mt-0.5 shrink-0" />
        <span>
          PaySim has no native geographic data. Geo attributes are synthesized
          via a deterministic hash of <span className="font-mono">name_orig</span>,
          simulating a KYC enrichment join. In production this would come from a
          real KYC system or IP geolocation. The architecture is identical.
        </span>
      </div>
    </Card>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-md"
      style={{ background: "var(--color-surface)" }}
    >
      {options.map(({ v, l }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-2 py-0.5 rounded text-xs transition-colors"
          style={
            v === value
              ? {
                  background: "var(--color-surface-elevated)",
                  color: "var(--color-fg)",
                }
              : { color: "var(--color-fg-subtle)" }
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

// world-atlas TopoJSON uses M.49 numeric codes; we map to ISO-3.
const M49_TO_ISO3: Record<string, string> = {
  "004": "AFG", "008": "ALB", "012": "DZA", "024": "AGO", "032": "ARG",
  "036": "AUS", "040": "AUT", "050": "BGD", "056": "BEL", "068": "BOL",
  "076": "BRA", "100": "BGR", "112": "BLR", "120": "CMR", "124": "CAN",
  "144": "LKA", "152": "CHL", "156": "CHN", "170": "COL", "178": "COG",
  "180": "COD", "188": "CRI", "192": "CUB", "196": "CYP", "203": "CZE",
  "208": "DNK", "214": "DOM", "218": "ECU", "222": "SLV", "231": "ETH",
  "232": "ERI", "246": "FIN", "250": "FRA", "262": "DJI", "266": "GAB",
  "268": "GEO", "270": "GMB", "275": "PSE", "276": "DEU", "288": "GHA",
  "300": "GRC", "320": "GTM", "324": "GIN", "328": "GUY", "332": "HTI",
  "340": "HND", "348": "HUN", "352": "ISL", "356": "IND", "360": "IDN",
  "364": "IRN", "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA",
  "384": "CIV", "388": "JAM", "392": "JPN", "398": "KAZ", "400": "JOR",
  "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "417": "KGZ",
  "418": "LAO", "422": "LBN", "428": "LVA", "430": "LBR", "434": "LBY",
  "440": "LTU", "454": "MWI", "458": "MYS", "466": "MLI", "478": "MRT",
  "484": "MEX", "496": "MNG", "498": "MDA", "504": "MAR", "508": "MOZ",
  "516": "NAM", "524": "NPL", "528": "NLD", "548": "VUT", "554": "NZL",
  "558": "NIC", "562": "NER", "566": "NGA", "578": "NOR", "586": "PAK",
  "591": "PAN", "598": "PNG", "600": "PRY", "604": "PER", "608": "PHL",
  "616": "POL", "620": "PRT", "624": "GNB", "626": "TLS", "630": "PRI",
  "634": "QAT", "642": "ROU", "643": "RUS", "646": "RWA", "682": "SAU",
  "686": "SEN", "688": "SRB", "694": "SLE", "702": "SGP", "703": "SVK",
  "704": "VNM", "705": "SVN", "706": "SOM", "710": "ZAF", "716": "ZWE",
  "724": "ESP", "728": "SSD", "729": "SDN", "740": "SUR", "748": "SWZ",
  "752": "SWE", "756": "CHE", "760": "SYR", "762": "TJK", "764": "THA",
  "768": "TGO", "780": "TTO", "784": "ARE", "788": "TUN", "792": "TUR",
  "795": "TKM", "800": "UGA", "804": "UKR", "807": "MKD", "818": "EGY",
  "826": "GBR", "834": "TZA", "840": "USA", "854": "BFA", "858": "URY",
  "860": "UZB", "862": "VEN", "882": "WSM", "887": "YEM", "894": "ZMB",
};