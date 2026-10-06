import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamesAdmin } from './games-admin';

describe('GamesAdmin', () => {
  let component: GamesAdmin;
  let fixture: ComponentFixture<GamesAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamesAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(GamesAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
