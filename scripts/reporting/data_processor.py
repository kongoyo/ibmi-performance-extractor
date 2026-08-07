def calculate_stats(dates, times, data_by_date, metrics):
    """
    Calculates max, max_time, and avg for each metric and date.
    Returns a nested dictionary: stats[metric_key][date] = { "max", "max_time", "avg" }
    """
    stats = {}
    for m in metrics:
        key = m["key"]
        stats[key] = {}
        for d in dates:
            arr = data_by_date.get(d, {}).get(key, [])
            if not arr:
                stats[key][d] = {"max": 0, "max_time": "N/A", "avg": 0.0}
                continue
            max_val = max(arr)
            max_idx = arr.index(max_val)
            avg_val = round(sum(arr) / len(arr), 2)
            stats[key][d] = {
                "max": max_val,
                "max_time": times[max_idx] if max_idx < len(times) else "N/A",
                "avg": avg_val
            }
    return stats

def get_panel_headers(key):
    """
    Returns the UI headers and units for the Top 10 jobs panel based on the metric key.
    """
    if key == "Rsp":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 交易回應時間排行",
            "val_header": "回應時間",
            "last_header": "實體 I/O 次數",
            "val_unit": "秒",
            "last_unit": "次"
        }
    elif key == "Count":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 交易次數排行",
            "val_header": "交易次數",
            "last_header": "平均回應時間",
            "val_unit": "次",
            "last_unit": "秒"
        }
    elif key == "Dsk":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 磁碟 I/O 排行",
            "val_header": "I/O 次數",
            "last_header": "CPU 耗時",
            "val_unit": "次",
            "last_unit": "ms"
        }
    elif key == "Usr":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 分頁缺失排行",
            "val_header": "分頁缺失",
            "last_header": "CPU 耗時",
            "val_unit": "次",
            "last_unit": "ms"
        }
    elif key == "Tot":
        return {
            "title": "🔥 尖峰時段 Top 10 Job CPU 負載排行",
            "val_header": "CPU 耗時",
            "last_header": "總 I/O 次數",
            "val_unit": "ms",
            "last_unit": "次"
        }
    elif key == "Int":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 互動式 CPU 排行",
            "val_header": "CPU 耗時",
            "last_header": "交易回應時間",
            "val_unit": "ms",
            "last_unit": "秒"
        }
    elif key == "Bch":
        return {
            "title": "🔥 尖峰時段 Top 10 Job 批次 CPU 排行",
            "val_header": "CPU 耗時",
            "last_header": "實體 I/O 次數",
            "val_unit": "ms",
            "last_unit": "次"
        }
    else:
        return {
            "title": "🔥 尖峰時段 Top 10 Job 負載排行",
            "val_header": "數值 1",
            "last_header": "數值 2",
            "val_unit": "",
            "last_unit": ""
        }
