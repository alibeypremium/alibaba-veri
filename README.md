# alibaba-veri

AliBaba Terminal sitesinin veri akışları. Site kodu özel bir depoda durur; bu depo yalnızca verileri üretir:

| İş akışı | Aralık | Çıktı dalı |
|---|---|---|
| tg | 5 dk | `veri` (tg.json, durum.json) |
| art | 10 dk | `veri-art` (art.json) |
| yt | 15 dk | `veri-yt` (yt.json) |
| ps | 6 saat | `veri-ps` |
| kurul | günlük | `veri-kurul` |

`config/feeds.json` ve `config/tv-embeds.json`, ana sitedeki haber beslemesi ve TV kanal listeleriyle aynı tutulmalıdır.
