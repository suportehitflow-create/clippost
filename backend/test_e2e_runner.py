import sys
import time
import json
from tasks import process_youtube_video, supabase

def get_test_user_id():
    try:
        res = supabase.table('projects').select('user_id').not_.is_('user_id', 'null').limit(1).execute()
        if res.data and res.data[0].get('user_id'):
            return res.data[0]['user_id']
    except Exception as e:
        print('[test_runner] aviso:', e)
    return 'test-user-e2e'

def run_test(name, url, clip_duration='auto'):
    user_id = get_test_user_id()
    print('=' * 60)
    print('INICIANDO TESTE E2E:', name)
    print('URL:', url, '| user_id:', user_id, '| duracao:', clip_duration)
    print('=' * 60)
    t0 = time.time()
    try:
        result = process_youtube_video(
            url=url,
            user_id=user_id,
            clip_duration=clip_duration,
            template_config={
                'brandName': 'clipost',
                'brandHandle': '@clipost',
                'subtitle_preset': 'hormozi_yellow',
                'subtitlePos': {'y': 78},
            }
        )
        elapsed = time.time() - t0
        print('-' * 60)
        print('RESULTADO DO TESTE [' + name + '] em ' + str(round(elapsed, 1)) + 's:')
        print(json.dumps(result, indent=2, ensure_ascii=False))
        if result.get('status') == 'success':
            project_id = result.get('project_id')
            clips_resp = supabase.table('clips').select('id, title, score, status, storage_url, start_time, end_time').eq('project_id', project_id).execute()
            clips = clips_resp.data or []
            print('[test_runner] ' + str(len(clips)) + ' clipes gravados no Supabase:')
            for idx, c in enumerate(clips):
                print('  [' + str(idx+1) + '] ' + str(c.get('title')) + ' | Status: ' + str(c.get('status')) + ' | URL: ' + str(c.get('storage_url')))
        return result
    except Exception as e:
        elapsed = time.time() - t0
        print('ERRO NO TESTE [' + name + '] apos ' + str(round(elapsed, 1)) + 's: ' + str(type(e).__name__) + ': ' + str(e))
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'error': str(e)}

if __name__ == '__main__':
    t = sys.argv[1] if len(sys.argv) > 1 else 'short'
    target_url = sys.argv[2] if len(sys.argv) > 2 else ''
    if t == 'short':
        u = target_url or 'https://www.youtube.com/watch?v=21X5lGlDOfg'
        run_test('VIDEO CURTO', u, '30')
    elif t == 'medium':
        u = target_url or 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'
        run_test('VIDEO MEDIO', u, '60')
    elif t == 'long':
        u = target_url or 'https://www.youtube.com/watch?v=kNNk_8g0R74'
        run_test('VIDEO LONGO', u, 'auto')
